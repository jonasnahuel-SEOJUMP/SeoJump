<?php
if (!defined('ABSPATH')) {
    exit;
}

class SEOJump_Connector_REST {
    public static function register_routes() {
        register_rest_route('seojump/v1', '/ping', array(
            'methods'             => 'GET',
            'callback'            => array(__CLASS__, 'ping'),
            'permission_callback' => array(__CLASS__, 'authorize'),
        ));

        register_rest_route('seojump/v1', '/apply', array(
            'methods'             => 'POST',
            'callback'            => array(__CLASS__, 'apply'),
            'permission_callback' => array(__CLASS__, 'authorize'),
        ));
    }

    public static function authorize(WP_REST_Request $request) {
        $token = get_option(SEOJUMP_CONNECTOR_OPTION, '');
        if (!$token) {
            return new WP_Error('seojump_no_token', 'Configurá el token en Ajustes → SEO Jump.', array('status' => 403));
        }

        $header = $request->get_header('authorization');
        $bearer = '';
        if (is_string($header) && preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
            $bearer = $m[1];
        }
        if (!$bearer) {
            $bearer = (string) $request->get_param('token');
        }

        if (!$bearer || !hash_equals($token, $bearer)) {
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
        ));
    }

    public static function apply(WP_REST_Request $request) {
        $page_url = esc_url_raw((string) $request->get_param('pageUrl'));
        $field    = sanitize_key((string) $request->get_param('field'));
        $value    = sanitize_text_field((string) $request->get_param('value'));

        if (!$page_url || !$value) {
            return new WP_Error('seojump_bad_request', 'Faltan pageUrl o value.', array('status' => 400));
        }
        if (!in_array($field, array('title', 'meta', 'h1'), true)) {
            return new WP_Error('seojump_bad_field', 'Campo no soportado.', array('status' => 400));
        }
        if (strlen($value) > 500) {
            return new WP_Error('seojump_too_long', 'Valor demasiado largo.', array('status' => 400));
        }

        $post_id = self::resolve_post_id($page_url);
        if (!$post_id) {
            return new WP_Error(
                'seojump_not_found',
                'No encontramos esa URL en WordPress. ¿Es una página/producto publicado?',
                array('status' => 404)
            );
        }

        $post = get_post($post_id);
        if (!$post || !in_array($post->post_status, array('publish', 'private', 'draft', 'future'), true)) {
            return new WP_Error('seojump_not_found', 'Entrada no editable.', array('status' => 404));
        }

        $updated = array();

        if ($field === 'title' || $field === 'h1') {
            // Título del post (suele ser el H1 del tema / WooCommerce)
            $result = wp_update_post(array(
                'ID'         => $post_id,
                'post_title' => $value,
            ), true);
            if (is_wp_error($result)) {
                return $result;
            }
            $updated[] = 'post_title';

            if (defined('WPSEO_VERSION')) {
                update_post_meta($post_id, '_yoast_wpseo_title', $value);
                $updated[] = 'yoast_title';
            }
            if (defined('RANK_MATH_VERSION') || class_exists('RankMath')) {
                update_post_meta($post_id, 'rank_math_title', $value);
                $updated[] = 'rank_math_title';
            }
        }

        if ($field === 'meta') {
            $wrote_seo = false;
            if (defined('WPSEO_VERSION')) {
                update_post_meta($post_id, '_yoast_wpseo_metadesc', $value);
                $updated[] = 'yoast_metadesc';
                $wrote_seo = true;
            }
            if (defined('RANK_MATH_VERSION') || class_exists('RankMath')) {
                update_post_meta($post_id, 'rank_math_description', $value);
                $updated[] = 'rank_math_description';
                $wrote_seo = true;
            }
            if (!$wrote_seo) {
                // Fallback: excerpt (muchos temas/SEO plugins lo usan si no hay metadesc)
                wp_update_post(array(
                    'ID'           => $post_id,
                    'post_excerpt' => $value,
                ));
                $updated[] = 'post_excerpt';
            }
        }

        clean_post_cache($post_id);

        return rest_ensure_response(array(
            'ok'      => true,
            'postId'  => $post_id,
            'updated' => $updated,
            'editUrl' => get_edit_post_link($post_id, 'raw'),
        ));
    }

    /**
     * Resuelve un post/página/producto a partir de una URL pública.
     */
    private static function resolve_post_id($page_url) {
        $post_id = url_to_postid($page_url);
        if ($post_id) {
            return (int) $post_id;
        }

        $path = wp_parse_url($page_url, PHP_URL_PATH);
        if (!$path) {
            return 0;
        }
        $path = trim($path, '/');
        if ($path === '') {
            $front = (int) get_option('page_on_front');
            return $front > 0 ? $front : 0;
        }

        // WooCommerce product by slug
        if (function_exists('wc_get_product_id_by_sku') || post_type_exists('product')) {
            $product = get_page_by_path(basename($path), OBJECT, 'product');
            if ($product) {
                return (int) $product->ID;
            }
            // full path under product category trees — try last segment
            $by_slug = get_posts(array(
                'name'        => basename($path),
                'post_type'   => array('product', 'page', 'post'),
                'post_status' => 'publish',
                'numberposts' => 1,
                'fields'      => 'ids',
            ));
            if (!empty($by_slug[0])) {
                return (int) $by_slug[0];
            }
        }

        $page = get_page_by_path($path, OBJECT, array('page', 'post'));
        if ($page) {
            return (int) $page->ID;
        }

        return 0;
    }
}
