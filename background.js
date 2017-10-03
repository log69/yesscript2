browser.webRequest.onHeadersReceived.addListener(
	function(details){

		// get domain part of the url
		var u = details.url.match(/:\/\/(.[^/]+)/)[1];
		// block scripts on page if url is marked bad (url exists in storage)
		if (localStorage.getItem(u)){

			// include the original response header too merging the two arrays here
			// the trick of blocking all scripts for a domain is adding CSP to the page header
			// https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
			var rh = details.responseHeaders.concat([{name: "Content-Security-Policy", value: "script-src 'none'"}]);
			return {responseHeaders: rh};
		}

		return {};
	},
	{urls: ["<all_urls>"]},
	["blocking", "responseHeaders"]
);


browser.browserAction.onClicked.addListener(
	function(details){

		// get domain part of the url
		var u = details.url.match(/:\/\/(.[^/]+)/)[1];
		if (u){
			// url exists?
			if (!localStorage.getItem(u)){
				// store it if not
				localStorage.setItem(u, 1);
				// set toolbar icon
				browser.browserAction.setIcon({path: "icons/icon2.svg"});
				// reload the page
				browser.tabs.reload();
			}
			else{
				// store it if not
				localStorage.removeItem(u);
				// set toolbar icon
				browser.browserAction.setIcon({path: "icons/icon.svg"});
				// reload the page
				browser.tabs.reload();
			}
		}
	}
);
