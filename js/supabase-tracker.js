(() => {
  "use strict";

  const config = window.PSM_SUPABASE;

  if (!config?.url || !config?.publishableKey) {
    console.warn("PSM Supabase configuration is missing.");
    return;
  }

  const createId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  };

  const getStoredId = (storage, key) => {
    let value = storage.getItem(key);

    if (!value) {
      value = createId();
      storage.setItem(key, value);
    }

    return value;
  };

  const visitorId = getStoredId(localStorage, "psm_visitor_id");
  const sessionId = getStoredId(sessionStorage, "psm_session_id");

  const apiHeaders = {
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.publishableKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal"
  };

  async function insertRow(table, data) {
    const response = await fetch(`${config.url}/rest/v1/${table}`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`${table}: ${response.status} ${message}`);
    }
  }

  function detectDevice() {
    const agent = navigator.userAgent.toLowerCase();

    if (/tablet|ipad/.test(agent)) return "tablet";
    if (/mobile|iphone|android/.test(agent)) return "mobile";

    return "desktop";
  }

  async function trackVisit() {
    try {
      const sessionRecordedKey = "psm_session_recorded";

      if (!sessionStorage.getItem(sessionRecordedKey)) {
        await insertRow("visitor_sessions", {
          visitor_id: visitorId,
          session_id: sessionId,
          landing_page: `${location.pathname}${location.search}`,
          referrer: document.referrer || null,
          device_type: detectDevice(),
          browser_language: navigator.language || null
        });

        sessionStorage.setItem(sessionRecordedKey, "true");
      }

      await insertRow("page_views", {
        visitor_id: visitorId,
        session_id: sessionId,
        page_path: `${location.pathname}${location.search}`
      });

      console.info("PSM analytics recorded successfully.");
    } catch (error) {
      console.warn("PSM analytics could not be recorded:", error);
    }
  }

  window.PSM_ANALYTICS = {
    visitorId,
    sessionId,
    trackVisit,
    insertRow
  };

  trackVisit();
})();
