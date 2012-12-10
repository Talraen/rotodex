/**
* jQuery Rotodex v1.0.0
* Vertical list with single expanding element for jQuery
*/

(function($) {
	$.Rotodex = function(options, element) {
		this.$element = $(element);

		this._create(options);
	};

	$.Rotodex.settings = {
		animate: false,
		center: false,
		clickable: false,
		delay: 0,
		hide: false,
		margin: 0,
		mousewheel: true,
		orientation: 'vertical',
		selected: 0,
		slider: false,
		snap: false,
		touch: true
	};

	$.Rotodex.prototype = {
		add: function(panel, position) {
			$panel = $(panel);
			if (typeof(position) == 'number') {
				var $nextPanel = $(this.$list.children()[position]);
			}

			if (typeof(position) == 'number' && $nextPanel.length > 0) {
				$nextPanel.before($panel);
			} else {
				this.$list.append($panel);
			}
			this._registerPanel($panel[0]);
		},

		move: function(fromIndex, toIndex) {
			if (typeof(fromIndex) != 'number') {
				fromIndex = this._getPanels().filter($(fromIndex)).index();
				if (fromIndex == -1) {
					return;
				}
			}

			if (typeof(toIndex) != 'number') {
				toIndex = this._getPanels().filter($(toIndex)).index();
				if (toIndex == -1) {
					return;
				}
			}

			if (fromIndex == toIndex) {
				return;
			}

			var $panels = this._getPanels();
			var from = $panels[fromIndex];
			var to = $panels[toIndex];

			if (toIndex < fromIndex) {
				$(to).before($(from));
			} else {
				$(to).after($(from));
			}

			if (fromIndex == this.activePanel) {
				this.select(toIndex);
			} else {
				if (toIndex >= this.activePanel && fromIndex < this.activePanel) {
					this.scrollPosition -= $.data(from, 'rotodex-size');
					this._updateScroll();
				} else if (toIndex <= this.activePanel && fromIndex > this.activePanel) {
					this.scrollPosition += $.data(from, 'rotodex-size');
					this._updateScroll();
				}
			}
		},

		refresh: function() {
			this._refreshSize();
		},

		remove: function(position) {
			if (typeof(position) == 'number') {
				removed = this.$list.children()[position];
				if (removed) {
					this._deregisterPanel(removed);
				}
			} else {
				var rotodex = this;
				this._getPanels().filter($(position)).each(function() {
					rotodex.remove($(this).index());
				});
			}
		},

		select: function(number) {
			if (typeof(number) == 'number') {
				if (number < 0) {
					number = 0;
				} else if (number >= this.panels) {
					number = this.panels - 1;
				}
				this._scrollTo(this._getPanelPosition(number), true);
				this.activePanel = number;
			} else {
				var index = this._getPanels().filter($(number)).index();
				if (index != -1) {
					this.select(index);
				}
			}
		},

		_getPanelPosition: function(number) {
			var $panels = this._getPanels();
			var scrollPosition = 0;
			for (var i = 0; i < number; i++) {
				scrollPosition += $.data($panels[i], 'rotodex-size');
			}
			return scrollPosition;
		},

		_create: function(options) {
			var rotodex = this;
			this.options = $.extend(true, {}, $.Rotodex.settings, options);
			this._refreshSize();

			this.scrollPosition = 0;
			this.activePanel = -1;
			this.expandTimer = null;
			this.lastTouch = 0;
			this.panels = 0;
			this.largest = 0;
			this.sliderMax = 1000;

			var $panels = this.$element.children();
			this.$list = $('<div class="rotodex-list"></div>').append($panels);
			this.$element.css({position: 'relative', overflow: 'hidden'}).append(this.$list);
			this._updateScroll();

			this._listSize(this.options.orientation == 'horizontal' ? 1000 : 0); // Make sure there is enough space for the first element to fully render, before list size is known

			var $panels = this._getPanels();
			for (var i = 0, panels = $panels.length; i < panels; i++) {
				this._registerPanel($panels[i]);
			}

			if (this.options.mousewheel) {
				var rotodex = this;
				this.$element.bind('mousewheel', function(event, delta, deltaX, deltaY) {
					// TODO: Determine why this event is being called multiple times
					if (typeof(delta) == 'undefined') {
						return; // This feature requires Brandon Aaron's mousewheel plugin
					}

					if (rotodex.options.orientation == 'horizontal') {
						delta = deltaX == 0 ? -deltaY : deltaX;
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

				this.select(this.options.selected);
			}

			if (this.options.touch) {
				var rotodex = this;
				this.$element.bind('touchstart', function(event) {
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
						rotodex.select(number);
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
					max: this.sliderMax,
					value: this.options.orientation == 'horizontal' ? 0 : this.sliderMax,
					animate: 'fast',
					orientation: this.options.orientation,
					slide: function(event, ui) {
						var multiplier = rotodex.options.orientation == 'horizontal' ? ui.value : rotodex.sliderMax - ui.value;
						rotodex._scrollTo(rotodex._maxPosition() * multiplier / rotodex.sliderMax);
					}
				});

				this.$element.append(this.$slider);

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
				this.$element.css('padding-' + side, '' + (parseInt(this.$element.css('padding-' + side)) + sliderSize) + 'px');

				// Create object containing CSS rules for slider
				var css = {};
				css.position = 'absolute';
				css[side] = 0;
				css[anchor] = 0;
				this.$slider.css(css);
			}

			this._refreshSize();
		},

		_deregisterPanel: function(panel) {
			var $panel = $(panel);
			var panelPosition = this._getPanelPosition($panel.index());
			this.panels--;

			if (this.activePanel == $panel.index()) {
				this.select(this.activePanel + 1);
			}

			var size = $.data(panel, 'rotodex-size');
			this._listSize(this._listSize() - size);

			$panel.remove();

			if (panelPosition < this.scrollPosition) {
				this.scrollPosition -= size;
			}
			this._updateScroll();
		},

		_expandPanel: function(panel) {
			var $panel = $(panel);
			var $elements = $panel.find('.rotodex-collapsible');
			var rotodex = this;
			window.clearTimeout(this.expandTimer);
			this.expandTimer = window.setTimeout(function() {
				if (rotodex.options.animate) {
					if (rotodex.options.orientation == 'horizontal') {
						$elements.animate({width: 'show', duration: rotodex.options.animate});
					} else {
						$elements.slideDown(rotodex.options.animate);
					}

					if (rotodex.options.center) {
						var css = {};
						css[rotodex.options.orientation == 'horizontal' ? 'margin-left' : 'margin-top'] = '' + (-1 * (rotodex.scrollPosition - rotodex.marginActive)) + 'px';
						rotodex.$list.animate(css, {duration: rotodex.options.animate});
					}
				} else {
					$elements.show();

					if (rotodex.options.delay && rotodex.options.center) {
						var css = {};
						css[rotodex.options.orientation == 'horizontal' ? 'margin-left' : 'margin-top'] = '' + (-1 * (rotodex.scrollPosition - rotodex.marginActive)) + 'px';
						rotodex.$list.css(css);
					}
				}

				if (rotodex.options.snap && $panel.index() >= 0) {
					rotodex.select($panel.index());
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
			if (!position) {
				position = this.scrollPosition;
			}
			var $panels = this._getPanels();
			for (var i = 0, panels = $panels.length; i < panels; i++) {
				if (position <= 0) {
					return i;
				}
				position -= $.data($panels[i], 'rotodex-size');
			}
		},

		_listSize: function(listSize) {
			if (typeof(listSize) == 'undefined') {
				return this.listSize || 0;
			} else {
				this.listSize = listSize;
				if (this.options.orientation == 'horizontal') {
					this.$list.width(this.listSize + this.largest); // Make the list wide enough to contain every element
				}
			}
		},

		_maxPosition: function() {
			// Don't include the last element's size, since you don't want to scroll past it
			var $panels = this._getPanels();
			if ($panels.length < 2) {
				return 0;
			}
			return this._listSize() - $.data($panels[$panels.length - 1], 'rotodex-size');
		},

		_refreshSize: function() {
			this.size = this.options.orientation == 'horizontal' ? this.$element.width() : this.$element.height();
			if (this.options.slider && this.$slider) {
				if (this.options.orientation == 'horizontal') {
					this.$slider.outerWidth(this.$element.width(), true);
				} else {
					this.$slider.outerHeight(this.$element.height(), true);
				}
			}
		},

		_registerPanel: function(panel) {
			var $panel = $(panel).addClass('rotodex-panel');

			var selector = this.options.header;
			var $displayElements = [];

			// If a selector was provided, use it
			if (selector) {
				$displayElements = $panel.children(selector);
			}

			// If there is no selector, or no items fit it, use the first child
			if ($displayElements.length == 0) {
				$displayElements = $panel.children().slice(0, 1);
			}

			if (this.options.orientation == 'horizontal') {
				$panel.css('float', 'left');
			}

			// Record full size
			var activeSize = this.options.orientation == 'horizontal' ? $panel.outerWidth(true) : $panel.outerHeight(true);
			$.data(panel, 'rotodex-active-size', activeSize);
			if (activeSize > this.largest) {
				this.largest = activeSize;
			}

			// Remove all other elements from view
			var $collapsible = $panel.children().not($displayElements);
			if (this.options.hide) {
				console.log($panel.find(this.options.hide).length);
				$collapsible = $collapsible.add($panel.find(this.options.hide));
			}
			$collapsible.addClass('rotodex-collapsible').hide();

			// Store the size of the collapsed version for future use
			var size = parseInt(this.options.orientation == 'horizontal' ? $panel.outerWidth(true) : $panel.outerHeight() + parseInt($panel.css('margin-bottom')));
			$.data(panel, 'rotodex-size', size);
			if (this.panels == 0) {
				this._listSize(size); // Reset the size for the first element
			} else {
				this._listSize(this._listSize() + size);
			}

			if (this.activePanel == -1) {
				this.select(0);
			}

			if (this._getPanelPosition($panel.index()) < this.scrollPosition) {
				this.scrollPosition += size;
			}
			this._updateScroll();

			this.panels++;
		},

		_scrollBy: function(delta) {
			var originalPosition = this.scrollPosition;
			this._scrollTo(this.scrollPosition + delta);
			return this.scrollPosition - originalPosition;
		},

		_scrollTo: function(position, animate) {
			if (position < 0) {
				position = 0;
			} else {
				var maxPosition = this._maxPosition();
				if (position >= maxPosition) {
					position = maxPosition;
				}
			}
			this.scrollPosition = position;

			var activePanel = this._getPanelByPosition();
			if (this.activePanel != activePanel) {
				this.activePanel = activePanel;

				var $panels = this._getPanels();
				$panels.find('.rotodex-collapsible').stop().hide();
				this._updateScroll(animate, true);
				this._expandPanel($panels[this.activePanel]);
			} else {
				this._updateScroll(animate);
			}
		},

		_updateScroll: function(animate, changePanel) {
			var margin;
			if (this.options.center) {
				var activePanel = this._getActivePanel();
				var collapsedSize = $.data(activePanel, 'rotodex-size');
				var activeSize = $.data(activePanel, 'rotodex-active-size');

				this.marginCollapsed = Math.floor((this.size - collapsedSize) / 2) || 0;
				if (this.options.margin > this.marginCollapsed) {
					this.marginCollapsed = this.options.margin;
				}

				this.marginActive = Math.floor((this.size - activeSize) / 2) || 0;
				if (this.options.margin > this.marginActive) {
					this.marginActive = this.options.margin;
				}

				if ((this.options.animate || this.options.delay) && changePanel) {
					margin = this.marginCollapsed;
				} else {
					margin = this.marginActive;
				}
			} else {
				margin = this.options.margin;
			}

			var css = {};
			css[this.options.orientation == 'horizontal' ? 'margin-left' : 'margin-top'] = '' + (-1 * (this.scrollPosition - margin)) + 'px';

			if (animate && this.options.animate) {
				this.$list.animate(css, {queue: false, duration: this.options.animate});
			} else {
				this.$list.stop(true).css(css);
			}

			if (this.options.slider && this.$slider) {
				var position = this.scrollPosition / this._maxPosition() * this.sliderMax;
				if (this.options.orientation != 'horizontal') {
					position = this.sliderMax - position;
				}
				this.$slider.slider('value', position);
			}
		}
	};

	$.fn.rotodex = function(options) {
		if (typeof(options) == 'string') {
			var args = Array.prototype.slice.call(arguments, 1);

			this.each(function() {
				var instance = $.data(this, 'rotodex');
				if (!instance) {
					console.log('Cannot call rotodex method ' + options + ' prior to initialization');
					return;
				}
				if (!$.isFunction(instance[options]) || options.charAt(0) == '_') {
					console.log('Method "' + options + '" not found in rotodex instance');
					return;
				}
				instance[options].apply(instance, args);
			})
		} else {
			this.each(function() {
				var instance = $.data(this, 'rotodex');
				if (instance) {
					instance.option(options || {});
					instance._init();
				} else {
					$.data(this, 'rotodex', new $.Rotodex(options, this));
				}
			});
		}

		return this;
	}
})(jQuery);
