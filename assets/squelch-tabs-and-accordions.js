
/*  Copyright (c) 2013 Nicola Hibbert  (http://nicolahibbert.com/liteaccordion-v2/)
    Extensions (c) 2013 Matt Lowe; Added support for jQuery UI theming
    
    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:
    
    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
;(function($) {

    var LiteAccordion = function(elem, options) {

        var defaults = {
            containerWidth : 960,                   // fixed (px)
            containerHeight : 320,                  // fixed (px)
            headerWidth : 48,                       // fixed (px)

            activateOn : 'click',                   // click or mouseover
            firstSlide : 1,                         // displays slide (n) on page load
            slideSpeed : 800,                       // slide animation speed
            onTriggerSlide : function(e) {},        // callback on slide activate
            onSlideAnimComplete : function() {},    // callback on slide anim complete

            autoPlay : false,                       // automatically cycle through slides
            pauseOnHover : false,                   // pause on hover
            cycleSpeed : 6000,                      // time between slide cycles
            easing : 'swing',                       // custom easing function

            theme : 'jqueryui',                     // jqueryui, basic, dark, light, or stitch
            rounded : false,                        // square or rounded corners
            enumerateSlides : false,                // put numbers on slides
            linkable : false                        // link slides via hash
        },

        // merge defaults with options in new settings object
            settings = $.extend({}, defaults, options),

        // 'globals'
            slides = elem.children('ol').children('li'),
            header = slides.children(':first-child'),
            slideLen = slides.length,
            slideWidth = settings.containerWidth - slideLen * settings.headerWidth,

        // public methods
            methods = {

                // start elem animation
                play : function(index) {
                    var next = core.nextSlide(index && index);

                    if (core.playing) return;

                    // start autoplay
                    core.playing = setInterval(function() {
                        header.eq(next()).trigger('click.liteAccordion');
                    }, settings.cycleSpeed);
                },

                // stop elem animation
                stop : function() {
                    clearInterval(core.playing);
                    core.playing = 0;
                },

                // trigger next slide
                next : function() {
                    methods.stop();
                    header.eq(core.currentSlide === slideLen - 1 ? 0 : core.currentSlide + 1).trigger('click.liteAccordion');
                },

                // trigger previous slide
                prev : function() {
                    methods.stop();
                    header.eq(core.currentSlide - 1).trigger('click.liteAccordion');
                },

                // destroy plugin instance
                destroy : function() {
                    // stop autoplay
                    methods.stop();

                    // remove hashchange event bound to window
                    $(window).off('.liteAccordion');

                    // remove generated styles, classes, data, events
                    elem
                        .attr('style', '')
                        .removeClass('liteAccordion basic dark light stitch')
                        .removeData('liteAccordion')
                        .off('.liteAccordion')
                        .find('li > :first-child')
                        .off('.liteAccordion')
                        .filter('.selected')
                        .removeClass('selected')
                        .end()
                        .find('b')
                        .remove();

                    slides
                        .removeClass('slide')
                        .children()
                        .attr('style', '');
                },

                // poke around the internals (NOT CHAINABLE)
                debug : function() {
                    return {
                        elem : elem,
                        defaults : defaults,
                        settings : settings,
                        methods : methods,
                        core : core
                    };
                }
            },

        // core utility and animation methods
            core = {

                // set style properties
                setStyles : function() {
                    // set container height and width, theme and corner style
                    elem
                        .width(settings.containerWidth)
                        .height(settings.containerHeight)
                        .addClass('liteAccordion')
                        .addClass(settings.rounded && 'rounded')
                        .addClass(settings.theme);

                    // jquery UI compatibility
                    if ('jqueryui' == settings.theme) {
                        elem
                            .addClass('ui-accordion')
                            .addClass('ui-widget');
                        elem
                            .find('h3')
                                .addClass('ui-helper-reset')
                                .find('span')
                                    .addClass('ui-accordion-header')
                                    .addClass('ui-state-default')
                                    .addClass('ui-corner-all');
                        elem.find('h3').next()
                            .addClass('ui-corner-all')
                            .addClass('ui-widget-content');
                    }

                    // set slide heights
                    slides
                        .addClass('slide')
                        .children(':first-child')
                        .height(settings.headerWidth);

                    // set slide positions
                    core.setSlidePositions();
                },

                // set initial positions for each slide
                setSlidePositions : function() {
                    var selected = header.filter('.selected');

                    // account for already selected slide
                    if (!selected.length)
                        header.eq(settings.firstSlide - 1).addClass('selected');

                    header.each(function(index) {
                        var $this = $(this),
                            left = index * settings.headerWidth,
                            margin = header.first().next(),
                            offset = parseInt(margin.css('marginLeft'), 10) || parseInt(margin.css('marginRight'), 10) || 0;

                        // compensate for already selected slide on resize
                        if (selected.length) {
                            if (index > header.index(selected)) left += slideWidth;
                        } else {
                            if (index >= settings.firstSlide) left += slideWidth;
                        }

                        // set each slide position
                        $this
                            .css('left', left)
                            .width(settings.containerHeight)
                            .next()
                                .width(slideWidth - offset)
                                .css({ left : left, paddingLeft : settings.headerWidth });

                        // add number to bottom of tab
                        settings.enumerateSlides && $this.append('<b>' + (index + 1) + '</b>');

                    });
                },

                // bind events
                bindEvents : function() {
                    // bind click and mouseover events
                    if (settings.activateOn === 'click') {
                        header.on('click.liteAccordion', core.triggerSlide);
                    } else if (settings.activateOn === 'mouseover') {
                        header.on('click.liteAccordion mouseover.liteAccordion', core.triggerSlide);
                    }

                    // bind hashchange event
                    if (settings.linkable) {
                        $(window).on('hashchange.liteAccordion', function(e) {
                            var url = slides.filter(function() {
                                return $(this).attr('data-slide-name') === window.location.hash.split('#')[1];
                            });

                            // if slide name exists
                            if (url.length) {
                                // trigger slide
                                core.triggerSlide.call(url.children('h3')[0], e);
                            }
                        });
                    }

                    // pause on hover (can't use custom events with $.hover())
                    if (settings.pauseOnHover && settings.autoPlay) {
                        elem
                            .on('mouseover.liteAccordion', function() {
                                core.playing && methods.stop();
                            })
                            .on('mouseout.liteAccordion', function() {
                                !core.playing && methods.play(core.currentSlide);
                            });
                    }
                },

                // counter for autoPlay (zero index firstSlide on init)
                currentSlide : settings.firstSlide - 1,

                // next slide index
                nextSlide : function(index) {
                    var next = index + 1 || core.currentSlide + 1;

                    // closure
                    return function() {
                        return next++ % slideLen;
                    };
                },

                // holds interval counter
                playing : 0,

                slideAnimCompleteFlag : false,

                // trigger slide animation
                triggerSlide : function(e) {
                    var $this = $(this),
                        tab = {
                            elem : $this,
                            index : header.index($this),
                            next : $this.next(),
                            prev : $this.parent().prev().children('h3'),
                            parent : $this.parent()
                        };

                    // current hash not correct?
                    if (settings.linkable && tab.parent.attr('data-slide-name')) {
                        if (tab.parent.attr('data-slide-name') !== window.location.hash.split('#')[1]) {
                            // exit early and try again (prevents double trigger (issue #60))
                            return window.location.hash = '#' + tab.parent.attr('data-slide-name');
                        }
                    }

                    // update core.currentSlide
                    core.currentSlide = tab.index;

                    // reset onSlideAnimComplete callback flag
                    core.slideAnimCompleteFlag = false;

                    // trigger callback in context of sibling div (jQuery wrapped)
                    settings.onTriggerSlide.call(tab.next, $this);

                    // animate
                    if ($this.hasClass('selected') && $this.position().left < slideWidth / 2) {
                        // animate single selected tab
                        core.animSlide.call(tab);
                    } else {
                        // animate groups
                        core.animSlideGroup(tab);
                    }

                    // stop autoplay, reset current slide index in core.nextSlide closure
                    if (settings.autoPlay) {
                        methods.stop();
                        methods.play(header.index(header.filter('.selected')));
                    }
                },

                animSlide : function(triggerTab) {
                    var _this = this;

                    // set pos for single selected tab
                    if (typeof this.pos === 'undefined') this.pos = slideWidth;

                    // remove, then add selected class
                    header.removeClass('selected').filter(this.elem).addClass('selected');

                    // if slide index not zero
                    if (!!this.index) {
                        this.elem
                            .add(this.next)
                            .stop(true)
                            .animate({
                                left : this.pos + this.index * settings.headerWidth
                            },
                                settings.slideSpeed,
                                settings.easing,
                                function() {
                                    // flag ensures that fn is only called one time per triggerSlide
                                    if (!core.slideAnimCompleteFlag) {
                                        // trigger onSlideAnimComplete callback in context of sibling div (jQuery wrapped)
                                        settings.onSlideAnimComplete.call(triggerTab ? triggerTab.next : _this.prev.next());
                                        core.slideAnimCompleteFlag = true;
                                    }
                                });

                            // remove, then add selected class
                            header.removeClass('selected').filter(this.prev).addClass('selected');

                    }
                },

                // animates left and right groups of slides
                animSlideGroup : function(triggerTab) {
                    var group = ['left', 'right'];

                    $.each(group, function(index, side) {
                        var filterExpr, left;

                        if (side === 'left')  {
                            filterExpr = ':lt(' + (triggerTab.index + 1) + ')';
                            left = 0;
                        } else {
                            filterExpr = ':gt(' + triggerTab.index + ')';
                            left = slideWidth;
                        }

                        slides
                            .filter(filterExpr)
                            .children('h3')
                            .each(function() {
                                var $this = $(this),
                                    tab = {
                                        elem : $this,
                                        index : header.index($this),
                                        next : $this.next(),
                                        prev : $this.parent().prev().children('h3'),
                                        pos : left
                                    };

                                // trigger item anim, pass original trigger context for callback fn
                                core.animSlide.call(tab, triggerTab);
                            });

                    });

                    // remove, then add selected class
                    header.removeClass('selected').filter(triggerTab.elem).addClass('selected');
                },

                ieClass : function(version) {
                    if (version < 7) methods.destroy();
                    if (version >= 10) return;
                    if (version === 7 || version === 8) {
                        slides.each(function(index) {
                            $(this).addClass('slide-' + index);
                        });
                    }

                    elem.addClass('ie ie' + version);
                },

                init : function() {
                    var ua = navigator.userAgent,
                        index = ua.indexOf('MSIE');

                    // test for ie
                    if (index !== -1) {
                        ua = ua.slice(index + 5, index + 7);
                        core.ieClass(+ua);
                    }

                    // init styles and events
                    core.setStyles();
                    core.bindEvents();

                    // check slide speed is not faster than cycle speed
                    if (settings.cycleSpeed < settings.slideSpeed) settings.cycleSpeed = settings.slideSpeed;

                    // init autoplay
                    settings.autoPlay && methods.play();
                }
            };

        // init plugin
        core.init();

        // expose methods
        return methods;

    };

    $.fn.liteAccordion = function(method) {
        var elem = this,
            instance = elem.data('liteAccordion');

        // if creating a new instance
        if (typeof method === 'object' || !method) {
            return elem.each(function() {
                var liteAccordion;

                // if plugin already instantiated, return
                if (instance) return;

                // otherwise create a new instance
                liteAccordion = new LiteAccordion(elem, method);
                elem.data('liteAccordion', liteAccordion);
            });

        // otherwise, call method on current instance
        } else if (typeof method === 'string' && instance[method]) {
            // debug method isn't chainable b/c we need the debug object to be returned
            if (method === 'debug') {
                return instance[method].call(elem);
            } else { // the rest of the methods are chainable though
                instance[method].call(elem);
                return elem;
            }
        }
    };

})(jQuery);



/*  Copyright 2013  Matt Lowe / Squelch Design  (http://squelch.it/  ... email: hi@squelchdesign.com)

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License, version 2, as 
    published by the Free Software Foundation, except where stated.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

*/
;(function($) {
    $.fn.openSquelchToggle = function(i) {

        var settings = $(this).data('settings');
        var $toggles = this.children('div');
        var $headers = this.children('h3');
        var $pane    = $toggles.eq(i);
        var $header  = $headers.eq(i);

        if (settings.theme == 'blank') {
            $header.find('span.ui-icon').addClass('ui-icon-triangle-1-e ui-icon-triangle-1-s');
        } else if (settings.theme == 'jqueryui') {
            $header.addClass('ui-accordion-header-active ui-state-active ui-corner-top ui-corner-all');
            $header.find('span.ui-icon').addClass('ui-icon-triangle-1-e ui-icon-triangle-1-s');
        } else {
            $header.addClass('squelch-taas-toggle-shortcode-header-active');
        }

        $pane.slideToggle(settings.speed);
    }



    $.fn.squelchToggles = function(options) {
        
        var defaults = {
            speed:      800,
            active:     false,
            theme:      'jqueryui'
        };

        var settings = $.extend({}, defaults, options);
        var $toggle  = this;
        var $toggles = this.children('div');
        var $headers = this.children('h3');

        $(this).data('settings', settings);

        // Add the jQuery UI accordion classes when needed
        if (settings.theme == 'blank') {
			$headers.each(function(){
				$(this).prepend('<span class="ui-icon ui-icon-triangle-1-e"></span>');				
			});
        } else if (settings.theme == 'jqueryui') {
            $toggle.addClass('ui-widget ui-accordion ui-widget ui-helper-reset');
            $toggles.addClass('ui-accordion-content ui-helper-reset ui-widget-content ui-corner-bottom');
            $headers.each(function() {
                $(this).addClass('ui-accordion-header ui-helper-reset ui-state-default ui-corner-all ui-accordion-icons');
                $(this).attr('role', 'tab');
                $(this).attr('aria-selected', 'false' );
                $(this).prepend('<span class="ui-accordion-header-icon ui-icon ui-icon-triangle-1-e"></span>');
            });
        }

        $toggles.hide();
        $toggle.addClass(settings.theme);

        // Add the actions:

        // hover
        $headers.hover(function() {
            if (settings.theme == 'jqueryui') {
                $(this).addClass('ui-state-hover');
            }
            $(this).addClass('squelch-taas-toggle-shortcode-header-hover');
        }, function() {
            if (settings.theme == 'jqueryui') {
                $(this).removeClass('ui-state-hover');
            }
            $(this).removeClass('squelch-taas-toggle-shortcode-header-hover');
        });

        // click
        $headers.click(function(ev) {
            if (settings.theme == 'blank') {
                $(this).find('span.ui-icon').toggleClass('ui-icon-triangle-1-e ui-icon-triangle-1-s');
            } else if (settings.theme == 'jqueryui') {
                $(this).toggleClass('ui-accordion-header-active ui-state-active ui-corner-top ui-corner-all');
                $(this).find('span.ui-icon').toggleClass('ui-icon-triangle-1-e ui-icon-triangle-1-s');
            } else {
                $(this).toggleClass('squelch-taas-toggle-shortcode-header-active');
            }

            $(this).next().slideToggle(settings.speed);

            ev.preventDefault();
            return false;
        });

        // Set active pane
        if ((settings.active !== false) && (settings.active != 'false') && (typeof(settings.active) == 'string')) {
            // active can be comma-separated to activate more than one pane
            var allActive = settings.active.split(/[, ]/);
            $.each( allActive, function(index, value) {
                var active = parseInt(value);

                if (!isNaN(active)) {
                    $headers.eq(value).click();
                }
            });
        }

        return $toggle;
    };
})(jQuery);



;(function($) {
    
    /**
     * Given any target, smoothly scrolls the page to make that item visible.
     *
     * @param target jQuery obj|jquery search string What to scroll to
     * @param callback Function to call back to on completion (optional)
     */
    var scrollToTarget = function( target, callback ) {

        var offset = Math.round( $(target).eq(0).offset().top - 200 );

        if ( $('#wpadminbar').length ) {
            offset -= $('#wpadminbar').length;
        }

        // Only execute the animation if it is needed
        if ($(window).scrollTop() !== offset) {

            $('html, body').animate({
                scrollTop: offset
            }, 1000, 'swing', function() {

                if (typeof( callback ) === 'function') {
                    callback();

                    // Prevent the callback being called twice (as we animate on TWO elements, html and body)
                    callback = null;
                }

            });

        } else {

            // No animation needed, but do call the callback (if set)
            if (typeof( callback ) === 'function') { callback(); }

        }

    };



    $(document).ready(function() {

        // Create accordions
        $(".squelch-taas-accordion").each(function() {

            var dataActive      = parseInt($(this).attr( 'data-active' ));
            var dataDisabled    = $(this).attr( 'data-disabled'     )   == 'true' ? true : false;
            var dataAutoHeight  = $(this).attr( 'data-autoheight'   )   == 'true' ? true : false;
            var dataCollapsible = $(this).attr( 'data-collapsible'  )   == 'true' ? true : false;

            var dataHeightStyle = dataAutoHeight ? 'auto' : 'content';

            $(this).accordion({
                disabled:       dataDisabled,
                active:         dataActive,
                heightStyle:    dataHeightStyle,
                collapsible:    dataCollapsible
            });
        });


        // Create hAccordions
        $(".squelch-taas-haccordion").each(function() {

            var dataWidth           = parseInt($(this).attr( 'data-width'       ));
            var dataHeight          = parseInt($(this).attr( 'data-height'      ));
            var dataHWidth          = parseInt($(this).attr( 'data-h-width'     ));

            var dataActivateOn      = $(this).attr( 'data-activate-on'           );
            var dataActive          = parseInt($(this).attr( 'data-active'      ));
            var dataSpeed           = parseInt($(this).attr( 'data-speed'       ));

            var dataAutoPlay        = $(this).attr( 'data-autoplay'         )   == 'true' ? true : false;
            var dataPauseOnHover    = $(this).attr( 'data-pauseonhover'     )   == 'true' ? true : false;
            var dataCycleSpeed      = parseInt($(this).attr( 'data-cyclespeed'  ));

            var dataTheme           = $(this).attr( 'data-theme'                 );
            var dataRounded         = $(this).attr( 'data-rounded'               );
            var dataEnumerate       = $(this).attr( 'data-enumerate'        )   == 'true' ? true : false;

            //TODO? Or drop support for this attribute?
            //var dataDisabled        = $(this).attr( 'data-disabled'         )   == 'true' ? true : false;

            $(this).liteAccordion({
                containerWidth:     dataWidth,
                containerHeight:    dataHeight,
                headerWidth:        dataHWidth,

                activateOn:         dataActivateOn,
                firstSlide:         dataActive,
                slideSpeed:         dataSpeed,

                autoPlay:           dataAutoPlay,
                pauseOnHover:       dataPauseOnHover,
                cycleSpeed:         dataCycleSpeed,

                theme:              dataTheme,
                rounded:            dataRounded,
                enumerateSlides:    dataEnumerate,

                onTriggerSlide:     function(tab) {
                    if ('jqueryui' === dataTheme) {
                        $(tab).parents('.squelch-taas-haccordion').eq(0).find('.ui-state-active').removeClass('ui-state-active');
                        $(tab).find('span').addClass('ui-state-active');
                    }
                }
            });
            if ('jqueryui' === dataTheme) $(this).find('.selected span').addClass('ui-state-active');
        });


        // Create tabs
        $(".squelch-taas-tab-group").each(function() {
            var dataDisabled    = $(this).attr( 'data-disabled'     )   == 'true' ? true : false;
            var dataCollapsible = $(this).attr( 'data-collapsible'  )   == 'true' ? true : false;
            var dataActive      = parseInt($(this).attr( 'data-active' ));
            var dataEvent       = $(this).attr( 'data-event' );

            $(this).tabs({
                disabled:       dataDisabled,
                collapsible:    dataCollapsible,
                active:         dataActive,
                event:          dataEvent
            });
        });


        // Create toggles
        $(".squelch-taas-toggle").each(function() {
            var dataSpeed   = $(this).attr( 'data-speed'  );
            var dataActive  = $(this).attr( 'data-active' );
            var dataTheme   = $(this).attr( 'data-theme'  );

            $(this).squelchToggles({
                speed:  dataSpeed,
                active: dataActive,
                theme:  dataTheme
            });
        });


        // Track changes in tabs / toggles / accordions / haccordions via the URL
        if (! squelch_taas_options.disable_magic_url) {
            $(  '.squelch-taas-tab > a,'+
                '.squelch-taas-toggle > h3,'+
                '.squelch-taas-toggle > h3 > a,'+
                '.squelch-taas-accordion > h3,'+
                '.squelch-taas-accordion > h3 > a,'+
                '.squelch-taas-haccordion > ol > li > h3 > span')
                .click(function(ev) {

                // Find out which page fragment to use (haccordions are different to everything else)
                var url = '';

                if (this.tagName.toUpperCase() == 'SPAN') {
                    // Assume it's an haccordion
                    url = document.location.origin + document.location.pathname + '#'+$(this).parents('h3').eq(0).attr('id');
                    //console.log(document.location);
                } else if (this.tagName.toUpperCase() == 'H3') {
                    url = $(this).children('a').get(0).href;
                } else {
                    url = this.href;
                }

                // Update the URL with the new fragment so that links to this page will link directly to the correct tab / accordion
                if (history.replaceState) history.replaceState({}, '', url);

            });
        }


        // On page load, if a fragment is present, tie it to a specific tab / toggle / accordion / haccordion
        if (document.location.hash && document.getElementById(document.location.hash.replace('#', ''))) {
            // Find the content panel the fragment refers to
            var panel = $(document.location.hash);


            // Tab -----------------------------------------------------------------------------------------------------
            if ($(panel).hasClass('ui-tabs-panel')) {
                var parentDiv = $(panel).parents('div').eq(0);
                var tabGroup  = $(panel).parents('.squelch-taas-tab-group');
                
                $(parentDiv).find('div.ui-tabs-panel').each(function(i, elem) {
                    if ($(this).attr('id') == panel.attr('id')) {
                        // Found the panel at index "i": Now tell jQuery UI to open that tab
                        tabGroup.tabs( "option", "active", i );
                    }
                });
            }


            // Toggle --------------------------------------------------------------------------------------------------
            if ($(panel).hasClass('squelch-taas-toggle-shortcode-content')) {
                var parentDiv = $(panel).parents('div.squelch-taas-toggle').eq(0);
                
                $(parentDiv).find('div.ui-accordion-content').each(function(i, elem) {
                    if ($(this).attr('id') == panel.attr('id')) {
                        // Found the panel at index "i": Now tell Squelch Toggles to open that toggle panel
                        parentDiv.openSquelchToggle( i );
                    }
                });
                
            }


            // Accordion -----------------------------------------------------------------------------------------------
            if ($(panel).hasClass('squelch-taas-accordion-shortcode-content')) {
                var parentDiv = $(panel).parents('div').eq(0);
                $(parentDiv).find('div.ui-accordion-content').each(function(i, elem) {
                    if ($(this).attr('id') == panel.attr('id')) {
                        // Found the panel at index "i": Now tell jQuery UI to open that accordion panel
                        parentDiv.accordion( "option", "active", i );
                    }
                });
            }


            // Horizontal accordion ------------------------------------------------------------------------------------
            if ($(panel).hasClass('squelch-taas-haccordion-shortcode')) {
                // TODO
            }
        }



        // Click handler for arbitrary links to tabs within the page
        $('a[href]')
                .not('.squelch-taas-accordion > h3')
                .not('.squelch-taas-accordion > h3 > a')
                .not('.squelch-taas-toggle > h3')
                .not('.squelch-taas-toggle > h3 > a')
                .not('.squelch-taas-tab > a')
                .click(function(ev) {
            if (this.hash) {

                // Verify whether this link is a target to the SAME PAGE first (if it looks like an external link, leave it alone)
                if (this.pathname == window.location.pathname) {

                    // Find the tabs / accordions this link should go to on THIS PAGE
                    var $targets = $('a[href="'+this.hash+'"]').not(this);

                    // Verify each of those targets is a tab/toggle/accordion/haccordion
                    $targets.each(function(i, target) {
                        
                        if ($(target).hasClass('ui-tabs-anchor')) {
                            // Tabs
                            scrollToTarget( target, function() {
                                $(target).click();
                            } );
                            ev.preventDefault();

                        } else if ($(target).parent().hasClass('squelch-taas-toggle-shortcode-header')) {
                            // Toggles
                            scrollToTarget( $(target).parent(), function() {
                                $(target).click();
                            } );
                            ev.preventDefault();

                        } else if ($(target).parent().hasClass('ui-accordion-header')) {
                            // Accordions
                            scrollToTarget( $(target).parent().parent().eq(0), function() {
                                $(target).click();
                            } );
                            ev.preventDefault();

                        } else if ($(target).hasClass('squelch-taas-haccordion-shortcode')) {
                            // Horizontal accordion
                            scrollToTarget( target, function() {
                                $(target).click();
                            } );
                            ev.preventDefault();

                        }

                    });


                }
            }
        });

    });

})(jQuery);


