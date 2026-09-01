// js/router.js - Simple Hash-Based SPA Router with Page Transitions

export class Router {
  constructor(routes = {}) {
    this.routes = routes; // Record of path -> render function
    this.containerClass = 'page-section';
    this.activeClass = 'active-page';
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRouting());
    
    // Initial routing on page load: check if DOM is already parsed to avoid race conditions
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      this.handleRouting();
    } else {
      document.addEventListener('DOMContentLoaded', () => this.handleRouting());
    }
  }

  handleRouting() {
    if (!window.location.hash) {
      window.location.hash = '#dashboard';
      return;
    }
    const fullHash = window.location.hash;
    const [routePath, queryStr] = fullHash.split('?');
    
    // Parse query parameters
    const params = {};
    if (queryStr) {
      const uSearchParams = new URLSearchParams(queryStr);
      for (const [key, value] of uSearchParams.entries()) {
        params[key] = value;
      }
    }

    const route = routePath.replace('#', '');
    const renderFunc = this.routes[route] || this.routes['dashboard'];

    const isNewRoute = this.currentRoute !== route;
    this.currentRoute = route;

    // Select the page elements
    const allPages = document.querySelectorAll(`.${this.containerClass}`);
    const activePage = document.getElementById(`${route}-section`) || document.getElementById('dashboard-section');

    if (activePage) {
      // Smooth page transition: fade out others, fade in target
      allPages.forEach(p => {
        p.classList.remove(this.activeClass);
        p.style.opacity = '0';
        p.style.pointerEvents = 'none';
        p.style.display = 'none';
      });

      activePage.style.display = 'block';
      // Force repaint to trigger CSS animation
      void activePage.offsetWidth;

      activePage.classList.add(this.activeClass);
      activePage.style.opacity = '1';
      activePage.style.pointerEvents = 'auto';

      // Scroll window to top ONLY on actual route change
      if (isNewRoute) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      // Run page render callback
      if (renderFunc) {
        renderFunc(params);
      }

      // Update active state on nav links
      this.updateNavHighlight(route);
    }
  }

  updateNavHighlight(route) {
    const desktopLinks = document.querySelectorAll('.desktop-nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    desktopLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${route}`) {
        link.classList.add('nav-active');
      } else {
        link.classList.remove('nav-active');
      }
    });

    mobileLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${route}`) {
        link.classList.add('nav-active-mobile');
      } else {
        link.classList.remove('nav-active-mobile');
      }
    });
  }

  // Programmatic navigation helper
  navigate(route, params = {}) {
    const paramStr = new URLSearchParams(params).toString();
    window.location.hash = route + (paramStr ? `?${paramStr}` : '');
  }
}
