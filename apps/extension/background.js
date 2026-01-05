chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "POST_TO_API") return;

  (async () => {
    try {
      const res = await fetch(msg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(msg.headers || {})
        },
        body: JSON.stringify(msg.payload)
      });

      const text = await res.text().catch(() => "");
      sendResponse({
        ok: res.ok,
        status: res.status,
        body: text
      });
    } catch (err) {
      sendResponse({
        ok: false,
        status: 0,
        error: String(err)
      });
    }
  })();

  // importante no MV3: manter a resposta async aberta
  return true;
});
