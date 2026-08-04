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
                'No encontramos esa URL en WordPress. Si es una categoría con permalink custom (ej. /estetica-vehicular/shampoos/), actualizá el plugin SEO Jump Connector a la última versión (Perfil → descargar ZIP → Plugins → Subir). Revisá también www/http y que esté publicada.',
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
     * Path limpio: sin query, sin /page/2, sin feed/amp.
     */
    private static function normalize_request_path($page_url) {
        $path = wp_parse_url($page_url, PHP_URL_PATH);
        if ($path === null || $path === false) {
            return '';
        }
        $path = rawurldecode((string) $path);
        $trimmed = trim($path, '/');
        $trimmed = preg_replace('#/page/\d+$#i', '', $trimmed);
        $trimmed = preg_replace('#/(feed|amp)$#i', '', $trimmed);
        return trim((string) $trimmed, '/');
    }

    /**
     * Variantes de URL para url_to_postid (www / esquema / barra final).
     *
     * @return string[]
     */
    private static function url_variants($page_url) {
        $variants = array($page_url);
        $parts = wp_parse_url($page_url);
        if (!is_array($parts) || empty($parts['host'])) {
            return array_values(array_unique($variants));
        }

        $scheme = !empty($parts['scheme']) ? $parts['scheme'] : 'https';
        $host = $parts['host'];
        $path = isset($parts['path']) ? $parts['path'] : '/';
        $host_bare = preg_replace('/^www\./i', '', $host);

        foreach (array($scheme, $scheme === 'https' ? 'http' : 'https') as $sch) {
            foreach (array($host_bare, 'www.' . $host_bare) as $h) {
                $base = $sch . '://' . $h . $path;
                $variants[] = $base;
                $variants[] = untrailingslashit($base);
                $variants[] = trailingslashit(untrailingslashit($base));
            }
        }

        return array_values(array_unique(array_filter($variants)));
    }

    /**
     * @return array{type:string,id:int,taxonomy?:string}|null
     */
    private static function resolve_target($page_url) {
        // 1) Post/página/producto por URL canónica (+ variantes www/http)
        foreach (self::url_variants($page_url) as $candidate) {
            $post_id = url_to_postid($candidate);
            if ($post_id > 0) {
                return array('type' => 'post', 'id' => (int) $post_id);
            }
        }

        $trimmed = self::normalize_request_path($page_url);

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

        // 4) Categoría de producto / taxonomías — match por get_term_link
        //    (cubre bases custom tipo /estetica-vehicular/shampoos/ y Permalink Manager)
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
        if ($slug === '' || is_numeric($slug)) {
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
     * Compara el path pedido con el permalink real del término (filtros de
     * Permalink Manager / Rank Math / base WooCommerce custom incluidos).
     */
    private static function term_path_matches($term, $trimmed) {
        $link = get_term_link($term);
        if (is_wp_error($link)) {
            return false;
        }
        $link_path = strtolower(trim((string) wp_parse_url($link, PHP_URL_PATH), '/'));
        $needle = strtolower($trimmed);
        if ($link_path === '' || $needle === '') {
            return false;
        }
        if ($link_path === $needle) {
            return true;
        }
        // Aceptar si el path pedido termina exactamente en el link del término
        // (p.ej. idioma prefijo) o viceversa.
        if (substr($needle, -strlen($link_path) - 1) === '/' . $link_path) {
            return true;
        }
        if (substr($link_path, -strlen($needle) - 1) === '/' . $needle) {
            return true;
        }
        return false;
    }

    /**
     * @return array{type:string,id:int,taxonomy:string}|null
     */
    private static function term_payload($term, $tax) {
        return array(
            'type'     => 'term',
            'id'       => (int) $term->term_id,
            'taxonomy' => $tax,
        );
    }

    /**
     * Mapea path → término. Prioriza coincidencia con get_term_link (permalinks custom).
     * Ej: estetica-vehicular/shampoos, categoria-producto/shampoos, product-category/x
     *
     * @return array{type:string,id:int,taxonomy:string}|null
     */
    private static function resolve_term_from_path($trimmed) {
        $taxonomies = self::candidate_taxonomies();
        $parts = array_values(array_filter(explode('/', $trimmed)));
        if (empty($parts)) {
            return null;
        }

        $slug_candidate = end($parts);
        $known_bases = array(
            'categoria-producto',
            'product-category',
            'product_cat',
            'product-tag',
            'categoria',
            'category',
            'estetica-vehicular',
            'tienda',
            'shop',
        );

        foreach ($taxonomies as $tax) {
            if (!taxonomy_exists($tax)) {
                continue;
            }

            // A) Términos con el mismo slug final cuyo link coincide con el path.
            $candidates = get_terms(array(
                'taxonomy'   => $tax,
                'slug'       => $slug_candidate,
                'hide_empty' => false,
                'number'     => 50,
            ));
            if (!is_wp_error($candidates) && !empty($candidates)) {
                foreach ($candidates as $term) {
                    if (self::term_path_matches($term, $trimmed)) {
                        return self::term_payload($term, $tax);
                    }
                }
            }

            // B) Base rewrite nativa o bases conocidas + slug
            $tax_obj = get_taxonomy($tax);
            $bases = $known_bases;
            if ($tax_obj && !empty($tax_obj->rewrite['slug'])) {
                array_unshift($bases, trim($tax_obj->rewrite['slug'], '/'));
            }
            $bases = array_values(array_unique(array_filter($bases)));

            foreach ($bases as $base) {
                $base_l = strtolower($base);
                $needle_l = strtolower($trimmed);
                if ($needle_l === $base_l . '/' . strtolower($slug_candidate)
                    || strpos($needle_l, $base_l . '/') === 0
                ) {
                    $term = get_term_by('slug', $slug_candidate, $tax);
                    if ($term && !is_wp_error($term)) {
                        // Si el link real coincide, perfecto; si la base es la del path, aceptar.
                        if (self::term_path_matches($term, $trimmed)
                            || strpos($needle_l, $base_l . '/') === 0
                        ) {
                            return self::term_payload($term, $tax);
                        }
                    }
                }
            }
        }

        // C) Último recurso (solo product_cat): recorrer términos y matchear link.
        //    Catálogos grandes: limitamos a 500; el caso típico ya resolvió en A/B.
        if (taxonomy_exists('product_cat')) {
            $all = get_terms(array(
                'taxonomy'   => 'product_cat',
                'hide_empty' => false,
                'number'     => 500,
            ));
            if (!is_wp_error($all) && !empty($all)) {
                foreach ($all as $term) {
                    if (self::term_path_matches($term, $trimmed)) {
                        return self::term_payload($term, 'product_cat');
                    }
                }
            }
        }

        return null;
    }
}
