<?php
if (!defined('ABSPATH')) {
    exit;
}

class SEOJump_Connector_Admin {
    public static function register_menu() {
        add_options_page(
            'SEO Jump Connector',
            'SEO Jump',
            'manage_options',
            'seo-jump-connector',
            array(__CLASS__, 'render_page')
        );
    }

    public static function register_settings() {
        register_setting('seojump_connector', SEOJUMP_CONNECTOR_OPTION, array(
            'type'              => 'string',
            'sanitize_callback' => array(__CLASS__, 'sanitize_token'),
            'default'           => '',
        ));
    }

    public static function sanitize_token($value) {
        $value = is_string($value) ? trim($value) : '';
        // Token SEO Jump: sj_ + base64url
        if ($value !== '' && !preg_match('/^sj_[A-Za-z0-9_-]{16,128}$/', $value)) {
            add_settings_error(
                'seojump_connector',
                'invalid_token',
                'El token no parece válido. Copialo completo desde SEO Jump (empieza con sj_).',
                'error'
            );
            return get_option(SEOJUMP_CONNECTOR_OPTION, '');
        }
        return $value;
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $token = get_option(SEOJUMP_CONNECTOR_OPTION, '');
        ?>
        <div class="wrap">
            <h1>SEO Jump Connector</h1>
            <p>Pegá acá el token que te muestra SEO Jump en <strong>Perfil → Conectar WordPress</strong>.</p>
            <p>Con esto, SEO Jump puede aplicar <strong>título SEO</strong> y <strong>meta descripción</strong> en tus páginas/productos cuando vos toques «Aplicar en mi web». No toca productos, precios ni diseño.</p>

            <form method="post" action="options.php">
                <?php settings_fields('seojump_connector'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="seojump_token">Token de conexión</label></th>
                        <td>
                            <input
                                name="<?php echo esc_attr(SEOJUMP_CONNECTOR_OPTION); ?>"
                                id="seojump_token"
                                type="text"
                                class="regular-text code"
                                value="<?php echo esc_attr($token); ?>"
                                autocomplete="off"
                                placeholder="sj_••••••••"
                            />
                            <p class="description">Guardalo y después tocá «Verificar conexión» en SEO Jump.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Guardar token'); ?>
            </form>

            <hr />
            <h2>Estado</h2>
            <?php if ($token) : ?>
                <p style="color:#0a7a2f;"><strong>✓ Token guardado.</strong> Volvé a SEO Jump y verificá la conexión.</p>
            <?php else : ?>
                <p style="color:#b32d2e;"><strong>Falta el token.</strong> Generarlo en SEO Jump → Perfil.</p>
            <?php endif; ?>
            <p>Endpoint REST: <code><?php echo esc_html(rest_url('seojump/v1/ping')); ?></code></p>
        </div>
        <?php
    }
}
