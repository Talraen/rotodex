/**
* jQuery Rotodex v1.0.0
* Vertical list with single expanding element for jQuery
*/

(function($) {
	$.Rotodex = function(options, element) {
		this.element = $(element);

		this._create(options);
	};

	$.Rotodex.settings = {
		animate: false,
		center: false,
		clickable: false,
		mousewheel: true,
		touch: true,
		delay: 0,
		margin: 0,
		orientation: 'vertical',
		slider: false,
		snap: false
	};

	$.Rotodex.prototype = {
		_collapsePanel: function(panel) {
			$(panel).children('.rotodex-collapsible').hide();
		},

		_create: function(options) {
			this.options = $.extend(true, {}, $.Rotodex.settings, options);

			this.scrollPosition = 0;
			this.activePanel = -1;
			this.expandTimer = null;
			this.lastTouch = 0;
			this._refreshSize();

			var $panels = this.element.children();
			this.$list = $('<div class="rotodex-list"></div>').append($panels);
			this.element.css({position: 'relative', overflow: 'hidden'}).append(this.$list);
			this._updateScroll();

			this.listSize = 0;

			var $panels = this._getPanels();
			for (var i = 0, panels = $panels.length; i < panels; i++) {
				this._registerPanel($panels[i]);
			}

			if (this.options.mousewheel) {
				var rotodex = this;
				this.element.bind('mousewheel', function(event, delta, deltaX, deltaY) {
					// TODO: Determine why this event is being called multiple times
					if (typeof(delta) == 'undefined') {
						return; // This feature requires Brandon Aaron's mousewheel plugin
					}

					if (rotodex.options.orientation == 'horizontal') {
						delta = deltaX == 0 ? deltaY : deltaX;
					} else {
						delta = -deltaY;
					}

					// Scroll speed treats 1 delta as the size of the current panel
					var current;
					var $panels = rotodex._getPanels();
					var number = rotodex.activePanel;
					if (delta < 0) {
						// When scrolling backward, move based on previous panel
						number--;
						if (number < 0) {
							number = 0;
						}
					}
					current = $panels[number];

					if (rotodex._scrollBy(delta * $.data(current, 'rotodex-size')) > 0 || rotodex.options.orientation == 'horizontal') {
						// Resume normal scrolling only if at the top or bottom of a vertical rotodex
						event.preventDefault();
					}
				});
			}

			if (this.options.touch) {
				var rotodex = this;
				this.element.bind('touchstart', function(event) {
					event.preventDefault();
					rotodex.lastTouch = rotodex.options.orientation == 'horizontal' ? event.originalEvent.touches[0].pageX : event.originalEvent.touches[0].pageY;
				}).bind('touchmove', function(event) {
					event.preventDefault();
					var touch = rotodex.options.orientation == 'horizontal' ? event.originalEvent.touches[0].pageX : event.originalEvent.touches[0].pageY;
					rotodex._scrollBy(rotodex.lastTouch - touch);
					rotodex.lastTouch = touch;
				});
			}

			if (this.options.clickable) {
				var rotodex = this;
				this._getPanels().click(function() {
					var number = $(this).index();
					if (rotodex.activePanel != number) {
						rotodex._showPanel(number);
						return false;
					}
				})
			}

			if (this.options.slider) {
				var rotodex = this;

				this.$slider = $("<div>").addClass('rotodex-slider');

				if (typeof(this.$slider.slider) != 'function') {
					return; // This feature requires the jQuery UI plugin
				}

				this.$slider.slider({
					min: 0,
					max: 1000,
					value: this.options.orientation == 'horizontal' ? 0 : 1000,
					animate: 'fast',
					orientation: this.options.orientation,
					slide: function(event, ui) {
						var multiplier = rotodex.options.orientation == 'horizontal' ? ui.value : 1000 - ui.value;
						rotodex._scrollTo(rotodex._maxPosition() * multiplier / 1000);
					}
				});

				this.element.append(this.$slider);

				// Add padding to outside element to make room for slider
				var side, anchor, sliderSize;
				if (this.options.orientation == 'horizontal') {
					side = this.options.slider == 'before' ? 'top' : 'bottom';
					anchor = 'left';
					sliderSize = this.$slider.outerHeight(true);
				} else {
					side = this.options.slider == 'before' ? 'left' : 'right';
					anchor = 'top';
					sliderSize = this.$slider.outerWidth(true);
				}
				this.element.css('padding-' + side, '' + (parseInt(this.element.css('padding-' + side)) + sliderSize) + 'px');

				// Create object containing CSS rules for slider
				var css = {};
				css.position = 'absolute';
				css[side] = 0;
				css[anchor] = 0;
				this.$slider.css(css);

				if (this.options.orientation == 'horizontal') {
					this.$slider.outerWidth(this.element.width(), true);
				} else {
					this.$slider.outerHeight(this.element.height(), true);
				}

			}
		},

		_expandPanel: function(panel) {
			var $panel = $(panel);
			var $elements = $panel.children('.rotodex-collapsible');
			var rotodex = this;
			window.clearTimeout(this.expandTimer);
			this.expandTimer = window.setTimeout(function() {
				if (rotodex.options.animate) {
					if (rotodex.options.orientation == 'horizontal') {
						$elements.animate({width: 'toggle', duration: rotodex.options.animate});
					} else {
						$elements.slideDown(rotodex.options.animate);
					}
					if (rotodex.options.snap) {
						rotodex._showPanel($panel.index());
					}
				} else {
					$elements.show();
				}
			}, this.options.delay)
		},

		_getActivePanel: function() {
			if (this.activePanel >= 0) {
				return this._getPanels()[this.activePanel];
			} else {
				return false;
			}
		},

		_getPanels: function() {
			return this.$list.children();
		},

		_getPanelByPosition: function(position) {
			var $panels = this._getPanels();
			for (var i = 0, panels = $panels.length; i < panels; i++) {
				if (position <= 0) {
					return i;
				}
				position -= $.data($panels[i], 'rotodex-size');
			}
		},

		_maxPosition: function() {
			// Don't include the last element's size, since you don't want to scroll past it
			var $panels = this._getPanels();
			if ($panels.length < 2) {
				return 0;
			}
			return this.listSize - $.data($panels[$panels.length - 1], 'rotodex-size');
		},

		_refreshSize: function() {
			this.size = this.options.orientation == 'horizontal' ? this.element.width() : this.element.height();
		},

		_registerPanel: function(panel) {
			var $panel = $(panel).addClass('rotodex-panel');

			var selector = this.options.header;
			var $displayElements = [];

			// If a selector was provided, use it
			if (selector) {
				$displayElements = $panel.find(selector);
			}

			// If there is no selector, or no items fit it, use the first child
			if ($displayElements.length == 0) {
				$displayElements = $panel.children().slice(0, 1);
			}

			if (this.options.orientation == 'horizontal') {
				$panel.css('float', 'left');
			}

			// Record full size
			$.data(panel, 'rotodex-active-size', this.options.orientation == 'horizontal' ? $panel.outerWidth() : $panel.outerHeight());

			// Remove all other elements from view
			$panel.children().not($displayElements).addClass('rotodex-collapsible').hide();

			// Store the size of the collapsed version for future use
			var size = this.options.orientation == 'horizontal' ? $panel.outerWidth(true) : $panel.outerHeight() + parseInt($panel.css('margin-bottom'));
			$.data(panel, 'rotodex-size', size);
			this.listSize += size;

			if (this.options.orientation == 'horizontal') {
				this.$list.width(this.listSize + 1000); // Make the list wide enough to contain every element
			}

			if (this.activePanel == -1) {
				this._showPanel(0);
			}
		},

		_scrollBy: function(delta) {
			var originalPosition = this.scrollPosition;
			this._scrollTo(this.scrollPosition + delta);
			return this.scrollPosition - originalPosition;
		},

		_scrollTo: function(position, jump) {
			if (position < 0) {
				position = 0;
			} else {
				var maxPosition = this._maxPosition();
				if (position >= maxPosition) {
					position = maxPosition;
				}
			}
			this.scrollPosition = position;

			var activePanel = this._getPanelByPosition(this.scrollPosition);
			if (this.activePanel != activePanel) {
				this.activePanel = activePanel;

				var $panels = this._getPanels();
				for (var i = 0, panels = $panels.length; i < panels; i++) {
					if (i == this.activePanel) {
						this._expandPanel($panels[i]);
					} else {
						this._collapsePanel($panels[i]);
					}
				}
			}

			this._updateScroll(jump);
		},

		_showPanel: function(number) {
			var $panels = this._getPanels();
			var scrollPosition = 0;
			for (var i = 0; i < number; i++) {
				scrollPosition += $.data($panels[i], 'rotodex-size');
			}
			this._scrollTo(scrollPosition, true);
			this.activePanel = number;
		},

		_updateScroll: function(jump) {
			var margin;
			if (this.options.center) {
				margin = Math.floor((this.size - $.data(this._getActivePanel(), 'rotodex-active-size'))/ 2);
				if (this.options.margin > margin) {
					margin = this.options.margin;
				}
			} else {
				margin = this.options.margin;
			}

			var css = {};
			css[this.options.orientation == 'horizontal' ? 'margin-left' : 'margin-top'] = '' + (-1 * (this.scrollPosition - margin)) + 'px';
			if (jump && this.options.animate) {
				this.$list.animate(css, {queue: false, duration: this.options.animate});
			} else {
				this.$list.css(css);
			}

			if (this.options.slider && this.$slider) {
				var position = this.scrollPosition / this._maxPosition() * 1000;
				if (this.options.orientation != 'horizontal') {
					position = 1000 - position;
				}
				this.$slider.slider('value', position);
			}
		}
	};

	$.fn.rotodex = function(options) {
		this.each(function() {
			var instance = $.data(this, 'rotodex');
			if (instance) {
				instance.option(options || {});
				instance._init();
			} else {
				$.data(this, 'rotodex', new $.Rotodex(options, this));
			}
		});

		return this;
	}
})(jQuery);
