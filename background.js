// check if page is marked untrusted and set icons and return state according to it
// flag values:
// 0 - return state
// 1 - set icon and return state
// 2 - set icon and set state and return state
function state(url, flag){
	var flag_untrusted = false;
	var flag_icon = false;

	if (url){
		// get domain part of the url
		var u2 = url.match(/:\/\/(.[^/]+)/);
		if (u2){
			var u = u2[1];

			// url exists? if so, it means page is marked untrusted
			flag_untrusted = localStorage.getItem(u);
			if (!flag_untrusted){
				if (flag >= 2){
					// mark page untrusted if icon was clicked
					localStorage.setItem(u, 1);
					flag_icon = true;
				}
				else{
					flag_icon = false;
				}
			}
			else{
				if (flag >= 2){
					// mark page trusted if icon was clicked
					localStorage.removeItem(u);
					flag_icon = false;
				}
				else{
					flag_icon = true;
				}
			}
		}

		// set toolbar icon
		if (flag >= 1){
			if (flag_icon){
				browser.browserAction.setIcon({path: "icons/icon2.svg"});
			}
			else{
				browser.browserAction.setIcon({path: "icons/icon.svg"});
			}
		}
	}

	return flag_untrusted;
}


// mark page untrusted or trusted when icon is clicked
browser.browserAction.onClicked.addListener(
	function(details){
		state(details.url, 2);
		browser.tabs.reload();
	}
);


// update icon when switching tab based on whether page is trusted
browser.tabs.onActivated.addListener(
	function(details){
		browser.tabs.query({currentWindow: true, active: true},
			function(tab){
				state(tab[0].url, 1);
			}
		);
	}
);


// block scripts on page if url is marked untrsuted based on whether url exists in storage
browser.webRequest.onHeadersReceived.addListener(
	function(details){

		if (state(details.url, 0)){

			// include the original response header too merging the two arrays here
			// the trick of blocking all scripts for a domain is adding CSP to the page header
			// https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
			var rh = details.responseHeaders.concat([{name: "Content-Security-Policy", value: "script-src 'none'"}]);
			return {responseHeaders: rh};
		}

		return {};
	},
	{urls: ["<all_urls>"], types: ["main_frame"]},
	["blocking", "responseHeaders"]
);
