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
 *
 * Resuelve: páginas, posts, productos WooCommerce, página Tienda y
 * categorías de producto (product_cat) — muy usadas en misiones de catálogo.
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

        $target = self::resolve_target($page_url);
        if (!$target) {
            return new WP_Error(
                'seojump_not_found',
                'No encontramos esa URL en WordPress. ¿Es una página, producto o categoría publicada? Revisá que sea la misma URL que ves en el navegador (con o sin www).',
                array('status' => 404)
            );
        }

        $updated = array();

        if ($target['type'] === 'post') {
            $post = get_post($target['id']);
            if (!$post || $post->post_status === 'trash') {
                return new WP_Error('seojump_not_found', 'Entrada no editable.', array('status' => 404));
            }
            if ($field === 'seo_title') {
                $updated = self::write_post_seo_title($target['id'], $value, $seo_plugin);
            } elseif ($field === 'meta') {
                $updated = self::write_post_meta_description($target['id'], $value, $seo_plugin);
            }
            clean_post_cache($target['id']);
            $edit_url = get_edit_post_link($target['id'], 'raw');
        } else {
            // term (categoría de producto, etc.)
            $term = get_term($target['id'], $target['taxonomy']);
            if (!$term || is_wp_error($term)) {
                return new WP_Error('seojump_not_found', 'Categoría no editable.', array('status' => 404));
            }
            if ($field === 'seo_title') {
                $updated = self::write_term_seo_title($target['id'], $target['taxonomy'], $value, $seo_plugin);
            } elseif ($field === 'meta') {
                $updated = self::write_term_meta_description($target['id'], $target['taxonomy'], $value, $seo_plugin);
            }
            clean_term_cache($target['id'], $target['taxonomy']);
            $edit_url = get_edit_term_link($target['id'], $target['taxonomy']);
        }

        if (empty($updated)) {
            return new WP_Error('seojump_write_failed', 'No se pudo guardar el cambio.', array('status' => 500));
        }

        return rest_ensure_response(array(
            'ok'        => true,
            'target'    => $target,
            'postId'    => $target['type'] === 'post' ? $target['id'] : 0,
            'termId'    => $target['type'] === 'term' ? $target['id'] : 0,
            'updated'   => $updated,
            'seoPlugin' => $seo_plugin,
            'editUrl'   => $edit_url ? $edit_url : '',
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

    private static function write_post_seo_title($post_id, $value, $seo_plugin) {
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

    private static function write_post_meta_description($post_id, $value, $seo_plugin) {
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

    private static function write_term_seo_title($term_id, $taxonomy, $value, $seo_plugin) {
        $updated = array();
        if ($seo_plugin === 'yoast') {
            update_term_meta($term_id, '_yoast_wpseo_title', $value);
            self::yoast_taxonomy_meta_set($term_id, $taxonomy, 'wpseo_title', $value);
            $updated[] = 'yoast_term_title';
        }
        if ($seo_plugin === 'rankmath') {
            update_term_meta($term_id, 'rank_math_title', $value);
            $updated[] = 'rank_math_term_title';
        }
        return $updated;
    }

    private static function write_term_meta_description($term_id, $taxonomy, $value, $seo_plugin) {
        $updated = array();
        if ($seo_plugin === 'yoast') {
            update_term_meta($term_id, '_yoast_wpseo_metadesc', $value);
            self::yoast_taxonomy_meta_set($term_id, $taxonomy, 'wpseo_desc', $value);
            $updated[] = 'yoast_term_metadesc';
        }
        if ($seo_plugin === 'rankmath') {
            update_term_meta($term_id, 'rank_math_description', $value);
            $updated[] = 'rank_math_term_description';
        }
        return $updated;
    }

    /**
     * Yoast también guarda taxonomías en la option wpseo_taxonomy_meta (legacy + UI).
     */
    private static function yoast_taxonomy_meta_set($term_id, $taxonomy, $key, $value) {
        $all = get_option('wpseo_taxonomy_meta', array());
        if (!is_array($all)) {
            $all = array();
        }
        if (!isset($all[$taxonomy]) || !is_array($all[$taxonomy])) {
            $all[$taxonomy] = array();
        }
        $tid = (string) $term_id;
        if (!isset($all[$taxonomy][$tid]) || !is_array($all[$taxonomy][$tid])) {
            $all[$taxonomy][$tid] = array();
        }
        $all[$taxonomy][$tid][$key] = $value;
        update_option('wpseo_taxonomy_meta', $all, false);
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
     * @return array{type:string,id:int,taxonomy?:string}|null
     */
    private static function resolve_target($page_url) {
        // 1) Post/página/producto por URL canónica
        $post_id = url_to_postid($page_url);
        if ($post_id > 0) {
            return array('type' => 'post', 'id' => (int) $post_id);
        }

        $path = wp_parse_url($page_url, PHP_URL_PATH);
        if ($path === null || $path === false) {
            return null;
        }

        $trimmed = trim($path, '/');

        // 2) Home / portada
        if ($trimmed === '') {
            $front = (int) get_option('page_on_front');
            return $front > 0 ? array('type' => 'post', 'id' => $front) : null;
        }

        // 3) Página Tienda de WooCommerce (/tienda, /shop, …)
        if (function_exists('wc_get_page_id')) {
            $shop_id = (int) wc_get_page_id('shop');
            if ($shop_id > 0) {
                $shop_path = trim((string) wp_parse_url(get_permalink($shop_id), PHP_URL_PATH), '/');
                if ($shop_path !== '' && strtolower($trimmed) === strtolower($shop_path)) {
                    return array('type' => 'post', 'id' => $shop_id);
                }
            }
        }

        // 4) Categoría de producto (y otras taxonomías públicas)
        $term = self::resolve_term_from_path($trimmed);
        if ($term) {
            return $term;
        }

        $post_types = array('page', 'post');
        if (post_type_exists('product')) {
            $post_types[] = 'product';
        }

        // 5) Path completo como page/product
        $found = get_page_by_path($trimmed, OBJECT, $post_types);
        if ($found instanceof WP_Post) {
            return array('type' => 'post', 'id' => (int) $found->ID);
        }

        // 6) Último segmento del path (productos con /categoria/slug)
        $slug = basename($trimmed);
        if ($slug === '') {
            return null;
        }

        $matches = get_posts(array(
            'name'           => $slug,
            'post_type'      => $post_types,
            'post_status'    => array('publish', 'private', 'draft', 'future'),
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'no_found_rows'  => true,
        ));

        if (!empty($matches[0])) {
            return array('type' => 'post', 'id' => (int) $matches[0]);
        }

        // 7) Categoría solo por slug final
        $taxonomies = self::candidate_taxonomies();
        foreach ($taxonomies as $tax) {
            $t = get_term_by('slug', $slug, $tax);
            if ($t && !is_wp_error($t)) {
                return array(
                    'type'     => 'term',
                    'id'       => (int) $t->term_id,
                    'taxonomy' => $tax,
                );
            }
        }

        return null;
    }

    private static function candidate_taxonomies() {
        $taxonomies = array('category', 'post_tag');
        if (taxonomy_exists('product_cat')) {
            array_unshift($taxonomies, 'product_cat');
        }
        if (taxonomy_exists('product_tag')) {
            $taxonomies[] = 'product_tag';
        }
        return $taxonomies;
    }

    /**
     * Intenta mapear el path a un término usando la estructura de permalinks.
     * Ej: categoria-producto/shampoos-para-auto  o  product-category/shampoos
     *
     * @return array{type:string,id:int,taxonomy:string}|null
     */
    private static function resolve_term_from_path($trimmed) {
        $taxonomies = self::candidate_taxonomies();
        $parts = array_values(array_filter(explode('/', $trimmed)));
        if (empty($parts)) {
            return null;
        }

        foreach ($taxonomies as $tax) {
            $tax_obj = get_taxonomy($tax);
            if (!$tax_obj) {
                continue;
            }

            // Base rewrite (ej. product_cat → "product-category" o personalizado)
            $base = '';
            if (!empty($tax_obj->rewrite['slug'])) {
                $base = trim($tax_obj->rewrite['slug'], '/');
            }

            $slug_candidate = end($parts);

            // Path tipo base/slug o base/parent/slug
            if ($base !== '') {
                $base_parts = explode('/', $base);
                $base_len = count($base_parts);
                if (count($parts) > $base_len) {
                    $prefix = array_slice($parts, 0, $base_len);
                    if (array_map('strtolower', $prefix) === array_map('strtolower', $base_parts)) {
                        $slug_candidate = end($parts);
                    }
                }
            }

            $term = get_term_by('slug', $slug_candidate, $tax);
            if ($term && !is_wp_error($term)) {
                // Si hay base, preferimos que el path la contenga (evita falsos positivos)
                if ($base === '' || stripos($trimmed, $base) !== false || count($parts) === 1) {
                    return array(
                        'type'     => 'term',
                        'id'       => (int) $term->term_id,
                        'taxonomy' => $tax,
                    );
                }
            }
        }

        // WooCommerce a veces usa ?product_cat=slug — ya cubierto por slug final arriba.
        // También probar path completo como slug jerárquico (parent/child).
        foreach ($taxonomies as $tax) {
            if (count($parts) < 2) {
                break;
            }
            $hierarchical_slug = implode('/', $parts);
            // get_term_by no acepta path jerárquico; probar solo el último + validar link
            $slug = end($parts);
            $term = get_term_by('slug', $slug, $tax);
            if ($term && !is_wp_error($term)) {
                $link = get_term_link($term);
                if (!is_wp_error($link)) {
                    $link_path = trim((string) wp_parse_url($link, PHP_URL_PATH), '/');
                    if (strtolower($link_path) === strtolower($trimmed)) {
                        return array(
                            'type'     => 'term',
                            'id'       => (int) $term->term_id,
                            'taxonomy' => $tax,
                        );
                    }
                }
            }
            unset($hierarchical_slug);
        }

        return null;
    }
}
