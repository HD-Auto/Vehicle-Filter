(function($) {
	$(document).ready(function() {
		console.log('VFD-DEBUG: jQuery document ready. Script started.');

		const makeSelect = $('#vfd-make');
		const modelSelect = $('#vfd-model');
		const yearSelect = $('#vfd-year');
		const submitButton = $('#vfd-submit-button'); // This button's text/action will change
		const resetButton = $('#vfd-reset-button'); // Reset on dropdown form
		const form = $('#vehicle-filter-form'); // The main dropdown form container

		const displayVehicleInfoContainer = $('#vfd-display-vehicle-info');
		const displayVehicleInfoText = displayVehicleInfoContainer.find('.vfd-info-text');
		const resetDisplayButton = $('#vfd-reset-display-button'); // Reset button for the displayed info
		const goToShopButton = $('#vfd-go-to-shop-button'); // This button is for display-only UI

		const shopUrl = vfd_ajax_object.shop_url;
		const SESSION_STORAGE_KEY = 'vfd_selected_filters';

		// --- Helper Functions ---
		function saveFiltersToSession(filters) {
			if (filters && filters.make && filters.model && filters.year && filters.makeName && filters.modelName && filters.yearName) {
				sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filters));
				console.log('VFD-DEBUG: Filters saved to session storage:', filters);
			} else {
				clearFiltersFromSession();
				console.log('VFD-DEBUG: Incomplete/Invalid filters provided to saveFiltersToSession. Session storage cleared.');
			}
		}

		function loadFiltersFromSession() {
			const storedFilters = sessionStorage.getItem(SESSION_STORAGE_KEY);
			if (storedFilters) {
				const parsed = JSON.parse(storedFilters);
				console.log('VFD-DEBUG: Filters loaded from session storage:', parsed);
				return parsed;
			}
			console.log('VFD-DEBUG: No filters found in session storage.');
			return null;
		}

		function clearFiltersFromSession() {
			sessionStorage.removeItem(SESSION_STORAGE_KEY);
			console.log('VFD-DEBUG: Session storage cleared.');
		}

		/**
		 * Toggles the text and enabled state of the primary submit button.
		 * @param {boolean} areFiltersComplete - True if all dropdowns have a selection.
		 */
		function toggleSubmitButton(areFiltersComplete) {
			if (areFiltersComplete) {
				submitButton.prop('disabled', false).removeClass('disabled').text('Set'); // Changed text
			} else {
				submitButton.prop('disabled', true).addClass('disabled').text('Set'); // Changed text
			}
			console.log('VFD-DEBUG: Submit button state updated. Disabled:', submitButton.prop('disabled'), 'Text:', submitButton.text());
		}

		function setLoadingState(element, isLoading, loadingText) {
			if (isLoading) {
				element.data('original-html', element.html()).prop('disabled', true).attr('data-loading', 'true');
				element.html('<option value="">' + loadingText + '</option>');
				console.log(`VFD-DEBUG: Setting loading state for ${element.attr('id')}: ${loadingText}`);
			} else {
				if (element.data('original-html')) {
					element.html(element.data('original-html'));
					element.removeData('original-html');
				}
				element.prop('disabled', false).removeAttr('data-loading');
				console.log(`VFD-DEBUG: Removing loading state for ${element.attr('id')}.`);
			}
		}

		/**
		 * Fetches term names by their IDs from a new AJAX endpoint.
		 */
		async function getTermNames(makeId, modelId, yearId) {
			console.log('VFD-DEBUG: Fetching term names for IDs:', { makeId, modelId, yearId });
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
					console.log('VFD-DEBUG: Term names fetched successfully:', response.data);
					return response.data;
				} else {
					console.error('VFD-DEBUG: Failed to fetch term names:', response);
					return null;
				}
			} catch (error) {
				console.error('VFD-DEBUG: AJAX error fetching term names:', error);
				return null;
			}
		}


		// --- UI State Management ---
		/**
		 * Shows the dropdown form and hides the display info.
		 * Resets dropdowns to initial "Select Make" state.
		 */
		function showDropdownForm() {
			console.log('VFD-DEBUG: showDropdownForm() called. Displaying dropdowns.');
			form.css('display', 'flex'); // Ensure it's flex
			displayVehicleInfoContainer.hide();

			// Reset dropdowns to default "Select Make" state
			makeSelect.val('');
			modelSelect.val('').prop('disabled', true).html('<option value="">Select Make First</option>');
			yearSelect.val('').prop('disabled', true).html('<option value="">Select Model First</option>');
			toggleSubmitButton(false); // Disable submit button, set text to "Select Vehicle"
		}

		/**
		 * Hides the dropdown form and displays the selected vehicle info.
		 * Also populates the dropdowns in the background, in case user clicks Reset.
		 * @param {object} filters - Object with make, model, year IDs and names.
		 */
		function showDisplayVehicleInfo(filters) {
			if (!filters || !filters.makeName || !filters.modelName || !filters.yearName) {
				console.error('VFD-DEBUG: Invalid filters for showDisplayVehicleInfo. Falling back to dropdowns.', filters);
				showDropdownForm(); // Fallback to dropdowns
				return;
			}

			console.log('VFD-DEBUG: showDisplayVehicleInfo() called with filters:', filters);
			form.hide(); // Hide the dropdown form
			displayVehicleInfoContainer.css('display', 'flex'); // Ensure it's flex for display

			displayVehicleInfoText.html(`My Vehicle: <strong>${filters.makeName}</strong> <strong>${filters.modelName}</strong> <strong>${filters.yearName}</strong>`);

			// Set the "Go to Shop" button link in the display view
			const currentFilteredShopUrl = new URL(shopUrl);
			currentFilteredShopUrl.searchParams.set('filterMake', filters.make);
			currentFilteredShopUrl.searchParams.set('filterModel', filters.model);
			currentFilteredShopUrl.searchParams.set('filterYear', filters.year);
			goToShopButton.attr('href', currentFilteredShopUrl.toString());
			console.log('VFD-DEBUG: "Go to Shop" button href set to:', goToShopButton.attr('href'));

			// Background populate dropdowns, in case user clicks Reset later
			makeSelect.val(filters.make);
			setTimeout(() => {
				makeSelect.trigger('change', [true]); // skipAjax=true
				setTimeout(() => {
					modelSelect.val(filters.model);
					modelSelect.trigger('change', [true]); // skipAjax=true
					setTimeout(() => {
						yearSelect.val(filters.year);
						// No toggleSubmitButton here, as dropdown form is hidden
					}, 50);
				}, 50);
			}, 50);
		}

		// --- Initialization Logic ---
		async function initializeUI() { // Made async to use await for getTermNames
			console.log('VFD-DEBUG: initializeUI() starting.');
			$('#vehicle-filter-container').addClass('vfd-loading');

			const storedFilters = loadFiltersFromSession();
			const currentUrl = new URL(window.location.href);

			const urlMake = currentUrl.searchParams.get('filterMake');
			const urlModel = currentUrl.searchParams.get('filterModel');
			const urlYear = currentUrl.searchParams.get('filterYear');

			console.log('VFD-DEBUG: Current URL filters on init:', { urlMake, urlModel, urlYear });
			console.log('VFD-DEBUG: Stored session filters on init:', storedFilters);

			let filtersToActivate = null; // Will store the complete filters (IDs + Names)

			// PRIORITY 1: Check if there are active filters in the URL.
			// This means we are currently on a filtered page (e.g., shop page after submission).
			if (urlMake && urlModel && urlYear) {
				console.log('VFD-DEBUG: Init Priority 1: Filters found in URL.');
				// We have IDs from URL, fetch names to store for display later
				const names = await getTermNames(urlMake, urlModel, urlYear);
				if (names) {
					filtersToActivate = { make: urlMake, model: urlModel, year: urlYear, ...names };
					saveFiltersToSession(filtersToActivate); // Save complete object to session
				} else {
					console.error('VFD-DEBUG: Could not fetch names for URL filters. Session not fully saved.');
					clearFiltersFromSession(); // Clear session if names can't be fetched
				}
			}
			// PRIORITY 2: If no URL filters, check if complete filters exist in session storage.
			else if (storedFilters && storedFilters.make && storedFilters.model && storedFilters.year && storedFilters.makeName && storedFilters.modelName && storedFilters.yearName) {
				console.log('VFD-DEBUG: Init Priority 2: Complete filters found in session storage.');
				filtersToActivate = storedFilters; // Already has names
			}

			// Now, decide UI based on filtersToActivate
			if (filtersToActivate) {
				console.log('VFD-DEBUG: Activating UI for filters:', filtersToActivate);
				// Show the "My Vehicle" display on ALL pages when filters are active
				showDisplayVehicleInfo(filtersToActivate);
			} else {
				console.log('VFD-DEBUG: No active filters found. Showing dropdown form.');
				showDropdownForm(); // Show the default dropdown form
			}

			// Remove loading class once UI state is determined and rendered
			$('#vehicle-filter-container').removeClass('vfd-loading');
			console.log('VFD-DEBUG: UI initialization complete. Removed loading class.');
		}

		// --- Event Listeners ---
		makeSelect.on('change', function(event, skipAjax) {
			console.log('VFD-DEBUG: Make dropdown changed. skipAjax:', skipAjax);
			const makeId = $(this).val();
			modelSelect.val('').prop('disabled', true).html('<option value="">Select Make First</option>');
			yearSelect.val('').prop('disabled', true).html('<option value="">Select Model First</option>');
			toggleSubmitButton(false); // Disable until all are selected

			if (!makeId) { clearFiltersFromSession(); return; } // Clear if make is deselected

			if (skipAjax) { return; } // Skip AJAX if triggered programmatically for initial set

			setLoadingState(modelSelect, true, 'Loading Models...');
			$.ajax({
				url: vfd_ajax_object.ajax_url, type: 'POST',
				data: { action: 'vfd_get_child_terms', parent_id: makeId, nonce: vfd_ajax_object.nonce },
				success: function(response) { console.log('VFD-DEBUG: Models AJAX success.'); setLoadingState(modelSelect, false); if (response.success && response.data) { modelSelect.html('<option value="">Select Model</option>'); if (response.data.length > 0) { $.each(response.data, function(i, term) { modelSelect.append($('<option>', { value: term.term_id, text: term.name })); }); modelSelect.prop('disabled', false); } else { modelSelect.html('<option value="">No Models Available</option>'); } } else { console.error('VFD-DEBUG: Models error:', response); modelSelect.html('<option value="">Error Loading Models</option>'); } },
				error: function(xhr, status, error) { console.error('VFD-DEBUG: AJAX Error loading models:', { xhr, status, error }); setLoadingState(modelSelect, false); modelSelect.html('<option value="">Error Loading Models</option>'); }
			});
		});

		modelSelect.on('change', function(event, skipAjax) {
			console.log('VFD-DEBUG: Model dropdown changed. skipAjax:', skipAjax);
			const modelId = $(this).val();
			yearSelect.val('').prop('disabled', true).html('<option value="">Select Model First</option>');
			toggleSubmitButton(false); // Disable until all are selected

			if (!modelId) { clearFiltersFromSession(); return; } // Clear if model is deselected

			if (skipAjax) { return; } // Skip AJAX if triggered programmatically for initial set

			setLoadingState(yearSelect, true, 'Loading Years...');
			$.ajax({
				url: vfd_ajax_object.ajax_url, type: 'POST',
				data: { action: 'vfd_get_year_terms', model_id: modelId, nonce: vfd_ajax_object.nonce },
				success: function(response) { console.log('VFD-DEBUG: Years AJAX success.'); setLoadingState(yearSelect, false); if (response.success && response.data) { yearSelect.html('<option value="">Select Year</option>'); if (response.data.length > 0) { response.data.sort((a, b) => parseInt(b.name) - parseInt(a.name)); $.each(response.data, function(i, term) { yearSelect.append($('<option>', { value: term.term_id, text: term.name })); }); yearSelect.prop('disabled', false); } else { yearSelect.html('<option value="">No Years Available</option>'); } } else { console.error('VFD-DEBUG: Years error:', response); yearSelect.html('<option value="">Error Loading Years</option>'); } },
				error: function(xhr, status, error) { console.error('VFD-DEBUG: AJAX Error loading years:', { xhr, status, error }); setLoadingState(yearSelect, false); yearSelect.html('<option value="">Error Loading Years</option>'); }
			});
		});

		yearSelect.on('change', function() {
			console.log('VFD-DEBUG: Year dropdown changed.');
			// Only enable submit if all 3 have values, set text to "Set Vehicle"
			const areFiltersComplete = makeSelect.val() && modelSelect.val() && yearSelect.val();
			toggleSubmitButton(areFiltersComplete);
			// No saveFiltersToSession here.
		});

		form.on('submit', async function(e) { // Make async here to allow await for names
			e.preventDefault(); // Prevent default submission - THIS IS CRITICAL NOW
			console.log('VFD-DEBUG: Form submit initiated (Set Vehicle).');

			const makeValue = makeSelect.val();
			const modelValue = modelSelect.val();
			const yearValue = yearSelect.val();

			if (!makeValue || !modelValue || !yearValue) {
				alert('Please select Make, Model, and Year before setting vehicle.');
				console.log('VFD-DEBUG: Form submission blocked due to incomplete selection.');
				return false;
			}

			submitButton.prop('disabled', true).text('Setting...'); // Indicate processing

			// Get the selected NAMES via AJAX to ensure accuracy for storage
			const names = await getTermNames(makeValue, modelValue, yearValue);

			if (names) {
				const selectedFilters = {
					make: makeValue, model: modelValue, year: yearValue,
					makeName: names.makeName, modelName: names.modelName, yearName: names.yearName
				};
				saveFiltersToSession(selectedFilters); // Save complete object
				console.log('VFD-DEBUG: Vehicle set and saved to session storage.');

				showDisplayVehicleInfo(selectedFilters); // Switch UI to "My Vehicle" display
			} else {
				console.error('VFD-DEBUG: Failed to get names for selected vehicle. Vehicle not set.');
				submitButton.prop('disabled', false).text('Error! Try Again.'); // Re-enable
			}
		});

		// The original resetButton (from the dropdown form)
		resetButton.on('click', function(e) {
			e.preventDefault();
			console.log('VFD-DEBUG: Dropdown form Reset button clicked. Clearing filters.');
			clearFiltersFromSession();
			showDropdownForm(); // Revert to initial dropdown state
			// No immediate redirect here, user is back in "select vehicle" mode
		});

		// The reset button in the "My Vehicle" display
		resetDisplayButton.on('click', function() {
			console.log('VFD-DEBUG: Display info Reset button clicked. Clearing filters.');
			clearFiltersFromSession();
			showDropdownForm(); // Show dropdowns again
			// No immediate redirect here, user is back in "select vehicle" mode
		});

		// Handle browser back/forward (pageshow fires for back/forward cache hits)
		$(window).on('pageshow', function(event) {
			if (event.originalEvent.persisted) {
				console.log('VFD-DEBUG: pageshow event triggered (from BFCache), re-initializing UI.');
				initializeUI();
			}
		});

		// Initial setup on page load
		console.log('VFD-DEBUG: Document ready. Calling initializeUI().');
		initializeUI();
	});
})(jQuery);