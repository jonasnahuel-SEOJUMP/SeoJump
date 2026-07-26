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
            'show_in_rest'      => false,
        ));
    }

    public static function sanitize_token($value) {
        $value = is_string($value) ? trim($value) : '';
        if ($value === '') {
            return '';
        }
        if (!preg_match('/^sj_[A-Za-z0-9_-]{16,128}$/', $value)) {
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
        $has_yoast = defined('WPSEO_VERSION');
        $has_rank  = defined('RANK_MATH_VERSION') || class_exists('RankMath');
        ?>
        <div class="wrap">
            <h1>SEO Jump Connector</h1>
            <p>
                Pegá el token de <strong>SEO Jump → Perfil → Conectar WordPress</strong>.
                Con esto, desde SEO Jump podés aplicar <strong>título SEO</strong> y
                <strong>meta descripción</strong> con un clic. No modifica precios, stock ni diseño.
            </p>

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
                                spellcheck="false"
                                placeholder="sj_••••••••"
                            />
                            <p class="description">Después de guardar, volvé a SEO Jump y tocá «Verificar conexión».</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Guardar token'); ?>
            </form>

            <hr />
            <h2>Requisitos</h2>
            <ul>
                <li>
                    <?php if ($has_yoast) : ?>
                        <span style="color:#0a7a2f;">✓ Yoast SEO detectado</span>
                    <?php elseif ($has_rank) : ?>
                        <span style="color:#0a7a2f;">✓ Rank Math detectado</span>
                    <?php else : ?>
                        <span style="color:#b32d2e;">✗ Hace falta Yoast SEO o Rank Math para aplicar título/meta automático</span>
                    <?php endif; ?>
                </li>
                <li>
                    <?php if ($token) : ?>
                        <span style="color:#0a7a2f;">✓ Token guardado</span>
                    <?php else : ?>
                        <span style="color:#b32d2e;">✗ Falta pegar el token</span>
                    <?php endif; ?>
                </li>
            </ul>
            <p>Endpoint: <code><?php echo esc_html(rest_url('seojump/v1/ping')); ?></code></p>
        </div>
        <?php
    }
}
