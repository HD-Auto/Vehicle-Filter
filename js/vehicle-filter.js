(function($) {
	$(document).ready(function() {
		const log = (message, ...args) => {
			const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
			console.log(`[${timestamp}] VFD-DEBUG: ${message}`, ...args);
		};
		log('jQuery document ready. Script started.');

		const vehicleFilterContainer = $('#vehicle-filter-container');
		const makeSelect = $('#vfd-make');
		const modelSelect = $('#vfd-model');
		const yearSelect = $('#vfd-year');
		const submitButton = $('#vfd-submit-button');
		const resetButton = $('#vfd-reset-button');
		const form = $('#vehicle-filter-form');

		const displayVehicleInfoContainer = $('#vfd-display-vehicle-info');
		const displayVehicleInfoText = displayVehicleInfoContainer.find('.vfd-info-text');
		const resetDisplayButton = $('#vfd-reset-display-button');
		const goToShopButton = $('#vfd-go-to-shop-button');

		const drawerToggle = $('#vfd-drawer-toggle');
		const drawerContent = $('#vfd-drawer-content');
		const drawerToggleText = drawerToggle.find('.vfd-toggle-text');

		const shopUrl = vfd_ajax_object.shop_url;
		const SESSION_STORAGE_KEY = 'vfd_selected_filters';

		// --- Helper Functions ---
		function saveFiltersToSession(filters) {
			if (filters && filters.make && filters.makeName && filters.model && filters.modelName && filters.year && filters.yearName) {
				sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filters));
				log('Filters saved to session storage:', filters);
			} else {
				clearFiltersFromSession();
				log('Incomplete/Invalid filters provided to saveFiltersToSession. Session storage cleared.', filters);
			}
		}

		function loadFiltersFromSession() {
			const storedFilters = sessionStorage.getItem(SESSION_STORAGE_KEY);
			if (storedFilters) {
				try {
					const parsed = JSON.parse(storedFilters);
					if (parsed && parsed.make && parsed.makeName && parsed.model && parsed.modelName && parsed.year && parsed.yearName) {
						log('Filters loaded from session storage and are complete:', parsed);
						return parsed;
					} else {
						log('Stored filters found but incomplete or invalid. Clearing session.', parsed);
						clearFiltersFromSession();
						return null;
					}
				} catch (e) {
					log('Error parsing session storage data. Clearing session.', e);
					clearFiltersFromSession();
					return null;
				}
			}
			log('No filters found in session storage.');
			return null;
		}

		function clearFiltersFromSession() {
			sessionStorage.removeItem(SESSION_STORAGE_KEY);
			log('Session storage cleared.');
		}

		function toggleSubmitButton(areFiltersComplete) {
			if (areFiltersComplete) {
				submitButton.prop('disabled', false).removeClass('disabled').text('Set Vehicle');
			} else {
				submitButton.prop('disabled', true).addClass('disabled').text('Select Vehicle');
			}
			log('Submit button state updated. Disabled:', submitButton.prop('disabled'), 'Text:', submitButton.text());
		}

		function setLoadingState(element, isLoading, loadingText) {
			if (isLoading) {
				element.data('original-html', element.html()).prop('disabled', true).attr('data-loading', 'true');
				element.html('<option value="">' + loadingText + '</option>');
				log(`Setting loading state for ${element.attr('id')}: ${loadingText}`);
			} else {
				if (element.data('original-html')) {
					element.html(element.data('original-html'));
					element.removeData('original-html');
				}
				element.prop('disabled', false).removeAttr('data-loading');
				log(`Removing loading state for ${element.attr('id')}.`);
			}
		}

		async function getTermNames(makeId, modelId, yearId) {
			log('Fetching term names for IDs:', { makeId, modelId, yearId });
			try {
				const response = await $.ajax({
					url: vfd_ajax_object.ajax_url,
					type: 'POST',
					data: {
						action: 'vfd_get_term_names',
						make_id: makeId,
						model_id: modelId,
						year_id: yearId,
						nonce: vfd_ajax_object.nonce
					}
				});

				if (response.success && response.data) {
					if (response.data.makeName && response.data.modelName && response.data.yearName) {
						log('Term names fetched successfully and are complete:', response.data);
						return response.data;
					} else {
						log('AJAX returned incomplete names. Rejecting data.', response.data);
						return null;
					}
				} else {
					log('Failed to fetch term names:', response);
					return null;
				}
			} catch (error) {
				log('AJAX error fetching term names:', error);
				return null;
			}
		}

		// --- UI State Management ---

		function isMobileLayout() {
			return window.matchMedia("(max-width: 1024px)").matches;
		}

		/**
		 * Shows the dropdown form and hides the display info.
		 * Resets dropdowns to initial "Select Make" state.
		 * Handles drawer state based on mobile layout.
		 */
		function showDropdownForm() {
			log('showDropdownForm() called. Displaying dropdowns (and handling drawer).');
			displayVehicleInfoContainer.hide(); // Always hide display info

			const mobile = isMobileLayout();

			if (mobile) {
				drawerToggle.show(); // Show mobile toggle
				drawerToggle.removeClass('active'); // Ensure drawer is closed visually
				drawerContent.hide(); // Hide content (jQuery slideToggle will handle height animation from here)
				form.hide(); // Keep form hidden inside the drawer (will be shown on slideToggle complete)
				drawerToggleText.text('Select Vehicle'); // Set toggle text
			} else {
				drawerToggle.hide(); // Hide mobile toggle
				drawerContent.show(); // Ensure content is visible on desktop (no max-height)
				form.css('display', 'flex'); // Show form directly on desktop
			}

			// Reset dropdowns to default "Select Make" state
			makeSelect.val('');
			modelSelect.val('').prop('disabled', true).html('<option value="">Select Make First</option>');
			yearSelect.val('').prop('disabled', true).html('<option value="">Select Model First</option>');
			toggleSubmitButton(false);
		}

		/**
		 * Hides the dropdown form and displays the selected vehicle info.
		 * Also populates the dropdowns in the background, in case user clicks Reset.
		 * Handles drawer state based on mobile layout.
		 * @param {object} filters - Object with make, model, year IDs and names.
		 */
		function showDisplayVehicleInfo(filters) {
			if (!filters || !filters.makeName || !filters.modelName || !filters.yearName) {
				log('Invalid filters for showDisplayVehicleInfo. Falling back to dropdowns.', filters);
				showDropdownForm(); // Fallback to dropdowns
				return;
			}

			log('showDisplayVehicleInfo() called with filters:', filters);

			form.hide(); // Hide the actual form
			drawerContent.hide(); // Hide and collapse drawer content using .hide()
			drawerToggle.hide(); // Hide the drawer toggle button as "My Vehicle" takes precedence

			displayVehicleInfoContainer.css('display', 'flex'); // Ensure display info is flex for display
			displayVehicleInfoText.html(`My Vehicle: <strong>${filters.makeName}</strong> <strong>${filters.modelName}</strong> <strong>${filters.yearName}</strong>`);

			const currentFilteredShopUrl = new URL(shopUrl);
			currentFilteredShopUrl.searchParams.set('filterMake', filters.make);
			currentFilteredShopUrl.searchParams.set('filterModel', filters.model);
			currentFilteredShopUrl.searchParams.set('filterYear', filters.year);
			goToShopButton.attr('href', currentFilteredShopUrl.toString());
			log('"Go to Shop" button href set to:', goToShopButton.attr('href'));

			// Background populate dropdowns, in case user clicks Reset later
			makeSelect.val(filters.make);
			setTimeout(() => {
				makeSelect.trigger('change', [true]);
				setTimeout(() => {
					modelSelect.val(filters.model);
					modelSelect.trigger('change', [true]);
					setTimeout(() => {
						yearSelect.val(filters.year);
					}, 50);
				}, 50);
			}, 50);
		}

		// --- Initialization Logic ---
		async function initializeUI() {
			log('initializeUI() starting.');
			vehicleFilterContainer.addClass('vfd-loading');

			const storedFilters = loadFiltersFromSession();
			const currentUrl = new URL(window.location.href);

			const urlMake = currentUrl.searchParams.get('filterMake');
			const urlModel = currentUrl.searchParams.get('filterModel');
			const urlYear = currentUrl.searchParams.get('filterYear');

			log('Current URL filters on init:', { urlMake, urlModel, urlYear });
			log('Stored session filters on init (re-read for final check):', storedFilters);

			let filtersToActivate = null;

			// PRIORITY 1: Check if there are active filters in the URL.
			if (urlMake && urlModel && urlYear) {
				log('Init Priority 1: Filters found in URL. Fetching names for storage and display.');
				const names = await getTermNames(urlMake, urlModel, urlYear);
				if (names) {
					filtersToActivate = { make: urlMake, model: urlModel, year: urlYear, ...names };
					log('Successfully fetched names for URL filters. Filters to activate:', filtersToActivate);
				} else {
					log('Could not fetch names for URL filters. Clearing session as unable to form complete filter object.');
					clearFiltersFromSession();
				}
			}
			// PRIORITY 2: If no URL filters, check if complete filters exist in session storage.
			else if (storedFilters) {
				log('Init Priority 2: Complete filters found in session storage (no URL filters).');
				filtersToActivate = storedFilters;
			} else {
				log('Init Priority 3: No complete filters found in URL or session storage.');
			}

			if (filtersToActivate) {
				log('Activating UI for filters:', filtersToActivate);
				showDisplayVehicleInfo(filtersToActivate);
				saveFiltersToSession(filtersToActivate);
			} else {
				log('No active filters found to activate. Showing dropdown form.');
				showDropdownForm();
			}

			vehicleFilterContainer.removeClass('vfd-loading');
			log('UI initialization complete. Removed loading class.');
		}

		// --- Event Listeners ---
		makeSelect.on('change', function(event, skipAjax) {
			log('Make dropdown changed. skipAjax:', skipAjax);
			const makeId = $(this).val();
			modelSelect.val('').prop('disabled', true).html('<option value="">Select Make First</option>');
			yearSelect.val('').prop('disabled', true).html('<option value="">Select Model First</option>');
			toggleSubmitButton(false);

			if (!makeId || skipAjax) {
				log('Skipping AJAX for make change due to no ID or skipAjax flag.');
				return;
			}

			setLoadingState(modelSelect, true, 'Loading Models...');
			$.ajax({
				url: vfd_ajax_object.ajax_url, type: 'POST',
				data: { action: 'vfd_get_child_terms', parent_id: makeId, nonce: vfd_ajax_object.nonce },
				success: function(response) { log('Models AJAX success.'); setLoadingState(modelSelect, false); if (response.success && response.data) { modelSelect.html('<option value="">Select Model</option>'); if (response.data.length > 0) { $.each(response.data, function(i, term) { modelSelect.append($('<option>', { value: term.term_id, text: term.name })); }); modelSelect.prop('disabled', false); } else { modelSelect.html('<option value="">No Models Available</option>'); } } else { log('Models error:', response); modelSelect.html('<option value="">Error Loading Models</option>'); } },
				error: function(xhr, status, error) { log('AJAX Error loading models:', { xhr, status, error }); setLoadingState(modelSelect, false); modelSelect.html('<option value="">Error Loading Models</option>'); }
			});
		});

		modelSelect.on('change', function(event, skipAjax) {
			log('Model dropdown changed. skipAjax:', skipAjax);
			const modelId = $(this).val();
			yearSelect.val('').prop('disabled', true).html('<option value="">Select Model First</option>');
			toggleSubmitButton(false);

			if (!modelId || skipAjax) {
				log('Skipping AJAX for model change due to no ID or skipAjax flag.');
				return;
			}

			setLoadingState(yearSelect, true, 'Loading Years...');
			$.ajax({
				url: vfd_ajax_object.ajax_url, type: 'POST',
				data: { action: 'vfd_get_year_terms', model_id: modelId, nonce: vfd_ajax_object.nonce },
				success: function(response) { log('Years AJAX success.'); setLoadingState(yearSelect, false); if (response.success && response.data) { yearSelect.html('<option value="">Select Year</option>'); if (response.data.length > 0) { response.data.sort((a, b) => parseInt(b.name) - parseInt(a.name)); $.each(response.data, function(i, term) { yearSelect.append($('<option>', { value: term.term_id, text: term.name })); }); yearSelect.prop('disabled', false); } else { yearSelect.html('<option value="">No Years Available</option>'); } } else { log('Years error:', response); yearSelect.html('<option value="">Error Loading Years</option>'); } },
				error: function(xhr, status, error) { log('AJAX Error loading years:', { xhr, status, error }); setLoadingState(modelSelect, false); modelSelect.html('<option value="">Error Loading Models</option>'); }
			});
		});

		yearSelect.on('change', function() {
			log('Year dropdown changed.');
			const areFiltersComplete = makeSelect.val() && modelSelect.val() && yearSelect.val();
			toggleSubmitButton(areFiltersComplete);
		});

		form.on('submit', async function(e) {
			e.preventDefault();
			log('Form submit initiated (Set Vehicle).');

			const makeValue = makeSelect.val();
			const modelValue = modelSelect.val();
			const yearValue = yearSelect.val();

			if (!makeValue || !modelValue || !yearValue) {
				alert('Please select Make, Model, and Year before setting vehicle.');
				log('Form submission blocked due to incomplete selection.');
				return false;
			}

			submitButton.prop('disabled', true).text('Setting...');

			const names = await getTermNames(makeValue, modelValue, yearValue);

			if (names) {
				const selectedFilters = {
					make: makeValue, model: modelValue, year: yearValue,
					makeName: names.makeName, modelName: names.modelName, yearName: names.yearName
				};
				log('Attempting to save selectedFilters after submit:', selectedFilters);
				saveFiltersToSession(selectedFilters);
				log('saveFiltersToSession call returned after submit.');

				log('Vehicle set and saved to session storage. Switching UI to display.');
				showDisplayVehicleInfo(selectedFilters);
			} else {
				log('Failed to get names for selected vehicle. Vehicle not set. Re-enabling submit button.');
				submitButton.prop('disabled', false).text('Error! Try Again.');
			}
		});

		resetButton.on('click', function(e) {
			e.preventDefault();
			log('Dropdown form Reset button clicked. Clearing filters and showing dropdown form.');
			clearFiltersFromSession();
			showDropdownForm();
		});

		resetDisplayButton.on('click', function() {
			log('Display info Reset button clicked. Clearing filters and showing dropdown form.');
			clearFiltersFromSession();
			showDropdownForm();
		});

		// --- Drawer Toggle Event Listener ---
		drawerToggle.on('click', function() {
			log('Drawer toggle clicked. Current state:', drawerToggle.hasClass('active') ? 'open' : 'closed');
			drawerToggle.toggleClass('active'); // Rotate icon
			drawerContent.slideToggle(300, function() {
				// Callback after slideToggle completes
				if (drawerContent.is(':visible')) {
					log('Drawer content is now visible. Ensuring form is flex.');
					form.css('display', 'flex'); // Ensure inner form is flex when drawer is open
				} else {
					log('Drawer content is now hidden. Hiding form.');
					form.hide(); // Ensure inner form is hidden when drawer is closed
				}
			});
		});

		// --- Handle window resize to adjust UI based on breakpoint ---
		let resizeTimeout;
		$(window).on('resize', function() {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(function() {
				log('Window resized. Re-evaluating UI based on layout.');
				initializeUI(); // Re-run init to adjust desktop/mobile layout
			}, 250);
		});

		// Initial setup on page load
		log('Document ready. Calling initializeUI().');
		initializeUI();
	});
})(jQuery);