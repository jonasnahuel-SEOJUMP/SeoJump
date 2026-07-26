<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * REST API del conector.
 *
 * Campos soportados:
 * - seo_title → título SEO (Yoast / Rank Math). No cambia el nombre del producto/página.
 * - meta      → meta descripción (Yoast / Rank Math).
 */
class SEOJump_Connector_REST {
    const NS = 'seojump/v1';

    public static function register_routes() {
        register_rest_route(self::NS, '/ping', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array(__CLASS__, 'ping'),
            'permission_callback' => array(__CLASS__, 'authorize'),
        ));

        register_rest_route(self::NS, '/apply', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => array(__CLASS__, 'apply'),
            'permission_callback' => array(__CLASS__, 'authorize'),
            'args'                => array(
                'pageUrl' => array(
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'esc_url_raw',
                ),
                'field' => array(
                    'required' => true,
                    'type'     => 'string',
                    'enum'     => array('seo_title', 'meta'),
                ),
                'value' => array(
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => array(__CLASS__, 'sanitize_value'),
                ),
            ),
        ));
    }

    public static function sanitize_value($value) {
        $value = wp_strip_all_tags((string) $value);
        $value = trim(preg_replace('/\s+/u', ' ', $value));
        return $value;
    }

    public static function authorize(WP_REST_Request $request) {
        $stored = get_option(SEOJUMP_CONNECTOR_OPTION, '');
        if (!is_string($stored) || $stored === '') {
            return new WP_Error(
                'seojump_no_token',
                'Configurá el token en Ajustes → SEO Jump.',
                array('status' => 403)
            );
        }

        $header = $request->get_header('authorization');
        if (!is_string($header) || !preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            return new WP_Error('seojump_unauthorized', 'Falta Authorization Bearer.', array('status' => 401));
        }

        if (!hash_equals($stored, $m[1])) {
            return new WP_Error('seojump_unauthorized', 'Token inválido.', array('status' => 401));
        }

        return true;
    }

    public static function ping() {
        return rest_ensure_response(array(
            'ok'       => true,
            'version'  => SEOJUMP_CONNECTOR_VERSION,
            'siteName' => get_bloginfo('name'),
            'home'     => home_url('/'),
            'seoPlugin'=> self::detect_seo_plugin(),
        ));
    }

    public static function apply(WP_REST_Request $request) {
        $page_url = (string) $request->get_param('pageUrl');
        $field    = (string) $request->get_param('field');
        $value    = (string) $request->get_param('value');

        if ($value === '') {
            return new WP_Error('seojump_empty', 'El texto está vacío.', array('status' => 400));
        }
        if (strlen($value) > 500) {
            return new WP_Error('seojump_too_long', 'Máximo 500 caracteres.', array('status' => 400));
        }

        if (!self::url_belongs_to_this_site($page_url)) {
            return new WP_Error(
                'seojump_wrong_site',
                'Esa URL no pertenece a este WordPress.',
                array('status' => 400)
            );
        }

        $seo_plugin = self::detect_seo_plugin();
        if ($seo_plugin === 'none') {
            return new WP_Error(
                'seojump_no_seo_plugin',
                'Para aplicar automático necesitás Yoast SEO o Rank Math instalado y activo. Si no, usá «Copiar sugerencia» y pegalo a mano.',
                array('status' => 422)
            );
        }

        $post_id = self::resolve_post_id($page_url);
        if (!$post_id) {
            return new WP_Error(
                'seojump_not_found',
                'No encontramos esa URL en WordPress. ¿Es una página o producto publicado?',
                array('status' => 404)
            );
        }

        $post = get_post($post_id);
        if (!$post || $post->post_status === 'trash') {
            return new WP_Error('seojump_not_found', 'Entrada no editable.', array('status' => 404));
        }

        $updated = array();

        if ($field === 'seo_title') {
            $updated = self::write_seo_title($post_id, $value, $seo_plugin);
        } elseif ($field === 'meta') {
            $updated = self::write_meta_description($post_id, $value, $seo_plugin);
        }

        if (empty($updated)) {
            return new WP_Error('seojump_write_failed', 'No se pudo guardar el cambio.', array('status' => 500));
        }

        clean_post_cache($post_id);

        return rest_ensure_response(array(
            'ok'        => true,
            'postId'    => $post_id,
            'updated'   => $updated,
            'seoPlugin' => $seo_plugin,
            'editUrl'   => get_edit_post_link($post_id, 'raw'),
        ));
    }

    private static function detect_seo_plugin() {
        if (defined('WPSEO_VERSION')) {
            return 'yoast';
        }
        if (defined('RANK_MATH_VERSION') || class_exists('RankMath')) {
            return 'rankmath';
        }
        return 'none';
    }

    private static function write_seo_title($post_id, $value, $seo_plugin) {
        $updated = array();
        if ($seo_plugin === 'yoast') {
            update_post_meta($post_id, '_yoast_wpseo_title', $value);
            $updated[] = 'yoast_title';
        }
        if ($seo_plugin === 'rankmath') {
            update_post_meta($post_id, 'rank_math_title', $value);
            $updated[] = 'rank_math_title';
        }
        return $updated;
    }

    private static function write_meta_description($post_id, $value, $seo_plugin) {
        $updated = array();
        if ($seo_plugin === 'yoast') {
            update_post_meta($post_id, '_yoast_wpseo_metadesc', $value);
            $updated[] = 'yoast_metadesc';
        }
        if ($seo_plugin === 'rankmath') {
            update_post_meta($post_id, 'rank_math_description', $value);
            $updated[] = 'rank_math_description';
        }
        return $updated;
    }

    private static function url_belongs_to_this_site($page_url) {
        $page_host = wp_parse_url($page_url, PHP_URL_HOST);
        $home_host = wp_parse_url(home_url('/'), PHP_URL_HOST);
        if (!$page_host || !$home_host) {
            return false;
        }
        $norm = static function ($host) {
            return strtolower(preg_replace('/^www\./i', '', $host));
        };
        return $norm($page_host) === $norm($home_host);
    }

    /**
     * Resuelve post/página/producto desde la URL pública.
     */
    private static function resolve_post_id($page_url) {
        $post_id = url_to_postid($page_url);
        if ($post_id > 0) {
            return (int) $post_id;
        }

        $path = wp_parse_url($page_url, PHP_URL_PATH);
        if ($path === null || $path === false) {
            return 0;
        }

        $trimmed = trim($path, '/');
        if ($trimmed === '') {
            $front = (int) get_option('page_on_front');
            return $front > 0 ? $front : 0;
        }

        $post_types = array('page', 'post');
        if (post_type_exists('product')) {
            $post_types[] = 'product';
        }

        // Path completo (ej. tienda/categoria/producto-slug no siempre aplica;
        // get_page_by_path funciona bien para pages jerárquicas y products).
        $found = get_page_by_path($trimmed, OBJECT, $post_types);
        if ($found instanceof WP_Post) {
            return (int) $found->ID;
        }

        // Último segmento del path (productos Woo con permalinks /categoria/slug).
        $slug = basename($trimmed);
        if ($slug === '' || $slug === $trimmed) {
            return 0;
        }

        $matches = get_posts(array(
            'name'           => $slug,
            'post_type'      => $post_types,
            'post_status'    => array('publish', 'private', 'draft', 'future'),
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'no_found_rows'  => true,
        ));

        return !empty($matches[0]) ? (int) $matches[0] : 0;
    }
}
