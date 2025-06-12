<?php
/**
 * Plugin Name:       Vehicle Filter Dropdowns
 * Plugin URI:        https://hdautomotive.com.au
 * Description:       Adds a shortcode [vehicle_filter_dropdowns] to display cascading dropdowns for the 'vehicles' custom taxonomy.
 * Version:           2.2.0
 * Author:            Brodie Owens
 * Author URI:        https://hdautomotive.com.au/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       vehicle-filter
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

// Define the taxonomy slug for easy reuse.
define('VFD_TAXONOMY', 'vehicle');
define('YEAR_TAXONOMY', 'model_year');

// Define VFD_SHOP_URL only after WooCommerce is loaded and WP is initialized
add_action('init', 'vfd_define_shop_url');
function vfd_define_shop_url() {
    if ( ! defined('VFD_SHOP_URL') ) {
        if ( class_exists( 'WooCommerce' ) && function_exists( 'wc_get_page_permalink' ) ) {
            define('VFD_SHOP_URL', wc_get_page_permalink('shop') ?: home_url('/shop/'));
        } else {
            define('VFD_SHOP_URL', home_url('/shop/'));
        }
    }
}


/**
 * Create the shortcode [vehicle_filter_dropdowns] to display the form.
 */
add_shortcode('vehicle_filter_dropdowns', 'vfd_display_dropdowns_shortcode');
function vfd_display_dropdowns_shortcode() {
    ob_start();

    $parent_terms = get_terms([
        'taxonomy'   => VFD_TAXONOMY,
        'hide_empty' => false,
        'parent'     => 0,
        'orderby'    => 'name',
        'order'      => 'ASC',
    ]);

    $selected_make = isset($_GET['filterMake']) ? intval($_GET['filterMake']) : '';
    $selected_model = isset($_GET['filterModel']) ? intval($_GET['filterModel']) : '';
    $selected_year = isset($_GET['filterYear']) ? intval($_GET['filterYear']) : '';

    $shop_url = defined('VFD_SHOP_URL') ? VFD_SHOP_URL : home_url('/shop/');

    ?>
    <div id="vehicle-filter-container" class="vehicle-filter-container">

        <!-- Drawer Toggle for Mobile -->
        <button id="vfd-drawer-toggle" class="vfd-drawer-toggle" style="display:none;">
            <span class="vfd-toggle-text">Select Vehicle</span>
            <span class="vfd-toggle-icon">&#x25BC;</span> <!-- Downward arrow -->
        </button>

        <!-- Drawer Content (wraps the form) -->
        <div id="vfd-drawer-content" class="vfd-drawer-content">
            <form id="vehicle-filter-form" class="vehicle-filter-form" method="GET" action="<?php echo esc_url($shop_url); ?>">
                <div class="filter-group">
                    <select name="filterMake" id="vfd-make">
                        <option value="">Select Make</option>
                        <?php if (!is_wp_error($parent_terms) && !empty($parent_terms)) : ?>
                            <?php foreach ($parent_terms as $term) : ?>
                                <option value="<?php echo esc_attr($term->term_id); ?>" <?php selected($selected_make, $term->term_id); ?>><?php echo esc_html($term->name); ?></option>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </select>
                </div>

                <div class="filter-group">
                    <select name="filterModel" id="vfd-model" <?php echo empty($selected_make) ? 'disabled' : ''; ?>>
                        <option value="">Select Make First</option>
                        <?php if ($selected_make) {
                            $child_terms = get_terms([
                                'taxonomy' => VFD_TAXONOMY,
                                'hide_empty' => false,
                                'parent' => $selected_make,
                                'orderby' => 'name',
                                'order' => 'ASC'
                            ]);
                            if (!is_wp_error($child_terms) && !empty($child_terms)) {
                                echo '<option value="">Select Model</option>';
                                foreach ($child_terms as $term) {
                                    echo '<option value="' . esc_attr($term->term_id) . '" ' . selected($selected_model, $term->term_id, false) . '>' . esc_html($term->name) . '</option>';
                                }
                            }
                        } ?>
                    </select>
                </div>

                <div class="filter-group">
                    <select name="filterYear" id="vfd-year" <?php echo empty($selected_model) ? 'disabled' : ''; ?>>
                        <option value="">Select Model First</option>
                        <?php if ($selected_model) {
                            $post_ids = get_posts([
                                'post_type' => 'product',
                                'posts_per_page' => -1,
                                'fields' => 'ids',
                                'tax_query' => [
                                    ['taxonomy' => VFD_TAXONOMY, 'field' => 'term_id', 'terms' => $selected_model],
                                ],
                            ]);

                            if (!empty($post_ids)) {
                                $year_terms = wp_get_object_terms($post_ids, YEAR_TAXONOMY, ['orderby' => 'name', 'order' => 'DESC']);
                                if (!is_wp_error($year_terms) && !empty($year_terms)) {
                                    echo '<option value="">Select Year</option>';
                                    $unique_years = [];
                                    foreach ($year_terms as $term) {
                                        if (!isset($unique_years[$term->term_id])) {
                                            $unique_years[$term->term_id] = $term;
                                        }
                                    }
                                    foreach ($unique_years as $term) {
                                        echo '<option value="' . esc_attr($term->term_id) . '" ' . selected($selected_year, $term->term_id, false) . '>' . esc_html($term->name) . '</option>';
                                    }
                                }
                            }
                        } ?>
                    </select>
                </div>

                <div class="filter-group filter-buttons">
                    <button type="submit" id="vfd-submit-button"
                        <?php echo (empty($selected_make) || empty($selected_model) || empty($selected_year)) ? 'disabled' : ''; ?>>
                        Filter Products
                    </button>
                    <button type="button" id="vfd-reset-button">Reset</button>
                </div>
            </form>
        </div><!-- #vfd-drawer-content -->

        <!-- My Vehicle Display (remains outside drawer for direct visibility) -->
        <div id="vfd-display-vehicle-info" style="display:none;">
            <span class="vfd-info-text"></span>
            <button type="button" id="vfd-reset-display-button" class="vfd-button-small">Reset</button>
            <a href="#" id="vfd-go-to-shop-button" class="vfd-button-small">Go to Shop</a>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// Apply filters to WooCommerce product query
add_action('pre_get_posts', 'vfd_filter_woocommerce_products');
function vfd_filter_woocommerce_products($query) {
    // Only apply on frontend main queries for shop/product pages
    if (is_admin() || !$query->is_main_query()) {
        return;
    }

    // Check if we're on a WooCommerce page where filtering should apply
    if (!(is_shop() || is_product_category() || is_product_tag() || is_woocommerce())) {
        return;
    }

    $tax_query = $query->get('tax_query') ?: [];
    $modified = false;

    // Check for model filter (which implicitly includes the make from its parent)
    if (isset($_GET['filterModel']) && !empty($_GET['filterModel'])) {
        $model_id = intval($_GET['filterModel']);
        $tax_query[] = [
            'taxonomy' => VFD_TAXONOMY,
            'field'    => 'term_id',
            'terms'    => $model_id,
        ];
        $modified = true;
    }

    // Check for year filter
    if (isset($_GET['filterYear']) && !empty($_GET['filterYear'])) {
        $year_id = intval($_GET['filterYear']);
        $tax_query[] = [
            'taxonomy' => YEAR_TAXONOMY,
            'field'    => 'term_id',
            'terms'    => $year_id,
        ];
        $modified = true;
    }

    if ($modified && !empty($tax_query)) {
        if (count($tax_query) > 1) {
            $tax_query['relation'] = 'AND'; // Combine multiple taxonomy queries with AND
        }
        $query->set('tax_query', $tax_query);

        // Debug logging (optional)
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('VFD: Applied tax_query: ' . print_r($tax_query, true));
        }
    }
}

// Enqueue scripts globally as the shortcode is site-wide
add_action('wp_enqueue_scripts', 'vfd_enqueue_scripts');
function vfd_enqueue_scripts() {
    // Ensure VFD_SHOP_URL is defined before attempting to use it here.
    $shop_url_for_js = defined('VFD_SHOP_URL') ? VFD_SHOP_URL : home_url('/shop/');

    wp_enqueue_script(
        'vehicle-filter-ajax',
        plugin_dir_url(__FILE__) . 'js/vehicle-filter.js',
        ['jquery'],
        time(), // AGGRESSIVE CACHE BUSTING FOR DEBUGGING - CHANGE TO A STATIC VERSION IN PRODUCTION!
        true
    );

    wp_enqueue_style(
        'vehicle-filter-css',
        plugin_dir_url(__FILE__) . 'css/vehicle-filter.css',
        [],
        time(), // AGGRESSIVE CACHE BUSTING FOR DEBUGGING - CHANGE TO A STATIC VERSION IN PRODUCTION!
    );

    // Pass data to JavaScript
    wp_localize_script('vehicle-filter-ajax', 'vfd_ajax_object', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce'    => wp_create_nonce('vfd_filter_nonce'),
        'shop_url' => $shop_url_for_js
    ]);
}

/**
 * AJAX Handler: Get child terms (Models).
 */
add_action('wp_ajax_vfd_get_child_terms', 'vfd_get_child_terms_callback');
add_action('wp_ajax_nopriv_vfd_get_child_terms', 'vfd_get_child_terms_callback');
function vfd_get_child_terms_callback() {
    // Verify nonce for security
    if (!wp_verify_nonce($_POST['nonce'], 'vfd_filter_nonce')) {
        wp_send_json_error('Security check failed.');
    }

    $parent_term_id = isset($_POST['parent_id']) ? intval($_POST['parent_id']) : 0;
    if (!$parent_term_id) {
        wp_send_json_error('No parent term provided.');
    }

    $child_terms = get_terms([
        'taxonomy'   => VFD_TAXONOMY,
        'hide_empty' => false,
        'parent'     => $parent_term_id,
        'orderby'    => 'name',
        'order'      => 'ASC'
    ]);

    if (is_wp_error($child_terms)) {
        wp_send_json_error('Could not retrieve terms: ' . $child_terms->get_error_message());
    }

    wp_send_json_success($child_terms);
}

/**
 * AJAX Handler: Get available years for a selected model.
 */
add_action('wp_ajax_vfd_get_year_terms', 'vfd_get_year_terms_callback');
add_action('wp_ajax_nopriv_vfd_get_year_terms', 'vfd_get_year_terms_callback');
function vfd_get_year_terms_callback() {
    check_ajax_referer('vfd_filter_nonce', 'nonce'); // Uses check_ajax_referer for consistency
    $model_term_id = isset($_POST['model_id']) ? intval($_POST['model_id']) : 0;
    if (!$model_term_id) wp_send_json_error('No model ID provided.');

    // Find products that have the selected model term.
    $post_ids = get_posts([
        'post_type'      => 'product',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'tax_query'      => [
            ['taxonomy' => VFD_TAXONOMY, 'field' => 'term_id', 'terms' => $model_term_id],
        ],
    ]);

    if (empty($post_ids)) {
        wp_send_json_success([]); // No products found for this model, so no years
        return;
    }

    // Get all 'model_year' terms associated with those products.
    $year_terms = wp_get_object_terms($post_ids, YEAR_TAXONOMY, ['orderby' => 'name', 'order' => 'DESC']);

    if (is_wp_error($year_terms)) wp_send_json_error('Could not retrieve year terms.');

    // Remove duplicates (wp_get_object_terms can return duplicates if a post has multiple terms)
    $unique_years = [];
    foreach ($year_terms as $term) {
        if (!isset($unique_years[$term->term_id])) {
            $unique_years[$term->term_id] = $term;
        }
    }

    wp_send_json_success(array_values($unique_years)); // Return unique terms
}

/**
 * AJAX Handler: Get term names by their IDs.
 * New endpoint for fetching names when needed by JavaScript initialization.
 */
add_action('wp_ajax_vfd_get_term_names', 'vfd_get_term_names_callback');
add_action('wp_ajax_nopriv_vfd_get_term_names', 'vfd_get_term_names_callback');
function vfd_get_term_names_callback() {
    check_ajax_referer('vfd_filter_nonce', 'nonce');

    $make_id = isset($_POST['make_id']) ? intval($_POST['make_id']) : 0;
    $model_id = isset($_POST['model_id']) ? intval($_POST['model_id']) : 0;
    $year_id = isset($_POST['year_id']) ? intval($_POST['year_id']) : 0;

    $response_data = [
        'makeName' => '',
        'modelName' => '',
        'yearName' => '',
    ];

    if ($make_id) {
        $term = get_term($make_id, VFD_TAXONOMY);
        if ($term && !is_wp_error($term)) {
            $response_data['makeName'] = $term->name;
        }
    }
    if ($model_id) {
        $term = get_term($model_id, VFD_TAXONOMY); // Model is also in VFD_TAXONOMY
        if ($term && !is_wp_error($term)) {
            $response_data['modelName'] = $term->name;
        }
    }
    if ($year_id) {
        $term = get_term($year_id, YEAR_TAXONOMY);
        if ($term && !is_wp_error($term)) {
            $response_data['yearName'] = $term->name;
        }
    }

    // Only send success if all three names were found, otherwise send error (or specific names if partially found)
    if ( $response_data['makeName'] && $response_data['modelName'] && $response_data['yearName'] ) {
        wp_send_json_success($response_data);
    } else {
        // Send error with partial data if some names couldn't be retrieved for debugging
        wp_send_json_error( $response_data );
    }
}

// Add debug info for admins (optional)
add_action('wp_footer', 'vfd_debug_info');
function vfd_debug_info() {
    if (current_user_can('manage_options') && (is_shop() || is_product_category())) {
        echo '<!-- VFD Debug: Active Filters -->';
        if (isset($_GET['filterMake'])) {
            echo '<!-- VFD: Make filter = ' . esc_html($_GET['filterMake']) . ' -->';
        }
        if (isset($_GET['filterModel'])) {
            echo '<!-- VFD: Model filter = ' . esc_html($_GET['filterModel']) . ' -->';
        }
        if (isset($_GET['filterYear'])) {
            echo '<!-- VFD: Year filter = ' . esc_html($_GET['filterYear']) . ' -->';
        }
    }
}