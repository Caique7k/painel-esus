chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "POST_TO_API") return;

  (async () => {
    try {
      const res = await fetch(msg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(msg.headers || {}),
        },
        body: JSON.stringify(msg.payload),
      });

      let body = null;
      try {
        body = await res.json(); // ✅ JSON
      } catch {
        body = null;
      }

      sendResponse({
        ok: res.ok,
        status: res.status,
        body,
      });
    } catch (err) {
      sendResponse({
        ok: false,
        status: 0,
        error: String(err),
      });
    }
  })();

  return true;
});
