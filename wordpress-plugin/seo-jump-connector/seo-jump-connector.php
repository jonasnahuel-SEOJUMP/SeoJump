<?php
/**
 * Plugin Name: SEO Jump Connector
 * Description: Permite que SEO Jump aplique títulos SEO y meta descripciones en tu WordPress con un clic (con tu aprobación).
 * Version: 1.0.0
 * Author: SEO Jump
 * Author URI: https://seo-jump.ai
 * License: GPL-2.0-or-later
 * Text Domain: seo-jump-connector
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SEOJUMP_CONNECTOR_VERSION', '1.0.0');
define('SEOJUMP_CONNECTOR_OPTION', 'seojump_connector_token');
define('SEOJUMP_CONNECTOR_FILE', __FILE__);

require_once plugin_dir_path(__FILE__) . 'includes/class-rest.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-admin.php';

add_action('rest_api_init', array('SEOJump_Connector_REST', 'register_routes'));
add_action('admin_menu', array('SEOJump_Connector_Admin', 'register_menu'));
add_action('admin_init', array('SEOJump_Connector_Admin', 'register_settings'));

/**
 * Enlace rápido a ajustes desde la lista de plugins.
 */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    $url = admin_url('options-general.php?page=seo-jump-connector');
    array_unshift($links, '<a href="' . esc_url($url) . '">' . esc_html__('Ajustes', 'seo-jump-connector') . '</a>');
    return $links;
});
