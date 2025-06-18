;(function($) {
	$(function() {
		const $dropdownWrapper    		= $('#vfd-dropdown-wrapper'),
			$displayVehicleInfo 		= $('#vfd-display-vehicle-info'),
			$displayVehicleContainer 	= $('#vfd-display-vehicle-container'),
			$infoText           		= $displayVehicleInfo.find('.vfd-info-text'),
			$goToShop           		= $('#vfd-go-to-shop-button'),
			$make               		= $('#vfd-make'),
			$model              		= $('#vfd-model'),
			$year               		= $('#vfd-year'),
			$body               		= $('#vfd-body'),
			$driveline               	= $('#vfd-driveline'),
			$submit             		= $('#vfd-submit-button'),
			$resetForm          		= $('#vfd-reset-button'),
			$resetDisplay       		= $('#vfd-reset-display-button'),
			$drawerToggle       		= $('#vfd-drawer-toggle'),
			$drawerContent      		= $('#vfd-drawer-content'),
			$form          	  			= $('#vehicle-filter-form'),
			shopUrl             		= vfd_ajax_object.shop_url,
			AJAX_URL            		= vfd_ajax_object.ajax_url,
			NONCE               		= vfd_ajax_object.nonce,
			SESSION_KEY        	= 'vfd_selected_filters';

		function log() {
			const ts = new Date()
				.toLocaleTimeString('en-US', {
					hour12:   false,
					hour:     '2-digit',
					minute:   '2-digit',
					second:   '2-digit',
					fractionalSecondDigits: 3
				});
			console.log(`[${ts}] VFD:`, ...arguments);
		}

		// Breakpoint test
		function isMobileLayout() {
			return window.matchMedia('(max-width:1024px)').matches;
		}

		/* Save to sessionStorage */
		function saveFilters(f) {
			if (
				f && f.make && f.makeName &&
				f.model && f.modelName &&
				f.year  && f.yearName &&
				f.body && f.bodyName &&
				f.driveline && f.drivelineName
			) {
				sessionStorage.setItem(SESSION_KEY, JSON.stringify(f));
				log('Saved filters →', f);
			} else {
				sessionStorage.removeItem(SESSION_KEY);
				log('Cleared session (invalid filters):', f);
			}
		}

		/* Load from sessionStorage */
		function loadFilters() {
			const raw = sessionStorage.getItem(SESSION_KEY);
			if (!raw) return null;
			try {
				const o = JSON.parse(raw);
				if (
					o.make && o.makeName &&
					o.model && o.modelName &&
					o.year  && o.yearName &&
					o.body && o.bodyName &&
					o.driveline && o.drivelineName
				) {
					log('Loaded filters from session →', o);
					return o;
				}
			} catch (e) {
				log('Error parsing saved filters:', e);
			}
			sessionStorage.removeItem(SESSION_KEY);
			return null;
		}

		/* Fetch names via AJAX */
		function fetchTermNames(makeId, modelId, yearId, bodyId, drivelineId) {
			return $.post({
				url:  AJAX_URL,
				data: {
					action:   'vfd_get_term_names',
					make_id:  makeId,
					model_id: modelId,
					year_id:  yearId,
					body_id:  bodyId,
					driveline_id: drivelineId,
					nonce:    NONCE
				}
			}).then(res => {
				if (res.success && res.data.makeName) {
					return res.data;
				}
				return $.Deferred().reject(res);
			});
		}

		/* Show the dropdown form, hide “My Vehicle” panel */
		function showDropdownForm() {
			log('showDropdownForm()');
			$displayVehicleContainer.hide();
			$displayVehicleInfo.hide();
			$dropdownWrapper.show();

			// Reset selects & submit
			$make.val('');
			$model
				.html('<option value="">Select Make First</option>')
				.prop('disabled', true);
			$year
				.html('<option value="">Select Model First</option>')
				.prop('disabled', true);
			$body
				.html('<option value="">Select Year First</option>')
				.prop('disabled', true);
			$driveline
				.html('<option value="">Select Body First</option>')
				.prop('disabled', true);
			$submit.prop('disabled', true).text('Set');

			// Mobile vs Desktop toggling
			if (isMobileLayout()) {
				$drawerToggle.show().removeClass('active');
				$drawerContent.hide();
			} else {
				$drawerToggle.hide();
				$drawerContent.show();
			}
		}

		/* Show “My Vehicle” panel, hide dropdown wrapper */
		function showDisplay(f) {
			log('showDisplay()', f);
			if (!(f && f.makeName)) {
				return showDropdownForm();
			}

			$dropdownWrapper.hide();

			$infoText.html(
				`My Vehicle: <strong>${f.makeName}</strong> ` +
				`<strong>${f.modelName}</strong> ` +
				`<strong>${f.yearName}</strong> ` +
				`<strong>${f.bodyName}</strong> ` +
				`<strong>${f.drivelineName}</strong>`
			);

			const url = new URL(shopUrl);
			url.searchParams.set('filterMake',  f.make);
			url.searchParams.set('filterModel', f.model);
			url.searchParams.set('filterYear',  f.year);
			url.searchParams.set('filterBody', f.body);
			url.searchParams.set('filterDriveline', f.driveline);
			$goToShop.attr('href', url.toString());

			$displayVehicleInfo.css('display', 'flex').show();
			$displayVehicleContainer.css('display', 'flex').show();
		}

		/* Initialize on page load */
		async function initialize() {
			log('initialize()');
			const params = new URL(window.location.href).searchParams;
			const m1 = params.get('filterMake'),
				m2 = params.get('filterModel'),
				y  = params.get('filterYear'),
				b = params.get('filterBody'),
				d = params.get('filterDriveline');
			let chosen = null;

			if (m1 && m2 && y && b && d) {
				try {
					const names = await fetchTermNames(m1, m2, y, b, d);
					chosen = {
						make: m1,
						model: m2,
						year: y,
						body: b,
						driveline: d,
						makeName:  names.makeName,
						modelName: names.modelName,
						yearName:  names.yearName,
						bodyName: names.bodyName,
						drivelineName: names.drivelineName
					};
					saveFilters(chosen);
				} catch (err) {
					log('Invalid URL filters → clear session');
					sessionStorage.removeItem(SESSION_KEY);
				}
			}

			if (!chosen) {
				chosen = loadFilters();
			}

			if (chosen) {
				showDisplay(chosen);
			} else {
				showDropdownForm();
			}
		}

		// --- EVENTS ---

		$make.on('change', function() {
			const id = $(this).val();
			$model.html('<option>Loading…</option>').prop('disabled', true);
			$year.html('<option>Select Model First</option>').prop('disabled', true);
			$body.html('<option>Select Year First</option>').prop('disabled', true);
			$driveline.html('<option>Select Body First</option>').prop('disabled', true);
			$submit.prop('disabled', true);

			if (!id) return;

			$.post({
				url: AJAX_URL,
				data: { action: 'vfd_get_child_terms', parent_id: id, nonce: NONCE }
			}).then(res => {
				if (res.success && res.data.length) {
					$model.html('<option value="">Select Model</option>');
					res.data.forEach(t => {
						$model.append(
							$('<option>', { value: t.term_id, text: t.name })
						);
					});
					$model.prop('disabled', false);
				} else {
					$model.html('<option>No Models Found</option>');
				}
			});
		});

		$model.on('change', function() {
			const id = $(this).val();
			$year.html('<option>Loading…</option>').prop('disabled', true);
			$body.html('<option value="">Select Year First</option>').prop('disabled', true);
			$driveline.html('<option value="">Select Body First</option>').prop('disabled', true);
			$submit.prop('disabled', true);

			if (!id) return;

			$.post({
				url: AJAX_URL,
				data: { action: 'vfd_get_year_terms', model_id: id, nonce: NONCE }
			}).then(res => {
				if (res.success && res.data.length) {
					res.data.sort((a,b) => parseInt(b.name) - parseInt(a.name));
					$year.html('<option value="">Select Year</option>');
					res.data.forEach(t => {
						$year.append(
							$('<option>', { value: t.term_id, text: t.name })
						);
					});
					$year.prop('disabled', false);
				} else {
					$year.html('<option>No Years Found</option>');
				}
			});
		});

		$year.on('change', function () {
			const yearId = $(this).val();
			const modelId = $model.val();

			$body.html('<option>Loading...</option>').prop('disabled', true);
			$driveline.html('<option value="">Select Body First</option>').prop('disabled', true);
			$submit.prop('disabled', true);

			if (! yearId || ! modelId) {
				$body.html('<option>Select Year First</option>');
				return;
			}

			$.post({
				url: AJAX_URL,
				data: {
					action: 'vfd_get_body_terms',
					model_id: modelId,
					year_id: yearId,
					nonce: NONCE
				}
			}).then(res => {
				if (res.success && res.data.length) {
					let html = '<option value="">Select Body Type</option>';
					res.data.forEach(t => {
						html += `<option value="${t.term_id}">${t.name}</option>`;
					});
					$body.html(html).prop('disabled', false);
				} else {
					$body.html(
						'<option value="">No Body Types Found</option>'
					);
				}
			});
		});

		$body.on('change', function() {
			const modelId = $model.val(),
				yearId  = $year.val(),
				bodyId  = $(this).val();

			$driveline
				.html('<option>Loading…</option>')
				.prop('disabled', true);
			$submit.prop('disabled', true);

			if (! modelId || ! yearId || ! bodyId) {
				$driveline.html(
					'<option value="">Select Body First</option>'
				);
				return;
			}

			$.post({
				url: AJAX_URL,
				data: {
					action:   'vfd_get_driveline_terms',
					model_id: modelId,
					year_id:  yearId,
					body_id:  bodyId,
					nonce:    NONCE,
				}
			}).then(res=>{
				if(res.success && res.data.length){
					let html = '<option value="">Select Driveline</option>';
					res.data.forEach(t => {
						html += `<option value="${t.term_id}">${t.name}</option>`;
					});
					$driveline.html(html).prop('disabled', false);
				} else {
					$driveline.html(
						'<option value="">No Drivelines Found</option>'
					);
				}
			});
		});

		$driveline.on('change', function() {
			$submit.prop('disabled', ! $(this).val());
		});

		$('#vehicle-filter-form').on('submit', async function(e) {
			e.preventDefault();
			const make  = $make.val(),
				model = $model.val(),
				year  = $year.val(),
				body = $body.val(),
				driveline = $driveline.val();
			if (!(make && model && year && body && driveline)) {
				return alert('Please select Make, Model, Year, Body and Driveline.');
			}
			$submit.prop('disabled', true).text('Setting…');
			try {
				const names = await fetchTermNames(make, model, year, body, driveline);
				const f     = {
					make, model, year, body, driveline,
					makeName:  names.makeName,
					modelName: names.modelName,
					yearName:  names.yearName,
					bodyName:  names.bodyName,
					drivelineName: names.drivelineName
				};
				saveFilters(f);
				showDisplay(f);
			} catch (err) {
				log('Error setting vehicle:', err);
				$submit.prop('disabled', false).text('Error – Try Again');
			}
		});

		$resetForm.on('click', function() {
			sessionStorage.removeItem(SESSION_KEY);
			showDropdownForm();
		});

		$resetDisplay.on('click', function() {
			sessionStorage.removeItem(SESSION_KEY);
			showDropdownForm();
		});

		// DRAWER TOGGLE (mobile)
		$drawerToggle.on('click', function() {
			log('Drawer toggle clicked. open?', $drawerToggle.hasClass('active'));
			$drawerToggle.toggleClass('active');

			if ( $drawerContent.is(':visible') ) {
				// close it
				$drawerContent.slideUp(200, function(){
					log('Drawer closed');
				});
			} else {
				// open it, then force flex
				$drawerContent.slideDown(200, function(){
					$drawerContent.css('display','flex');
					$form.css('display','flex');
					log('Drawer opened – display:flex restored');
				});
			}
		});

		$(window).on('resize', function() {
			clearTimeout(this._vfdTO);
			this._vfdTO = setTimeout(initialize, 250);
		});

		// first run
		initialize();
	});
})(jQuery);