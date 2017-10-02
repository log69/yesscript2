// info: WebExtension to block scripts on specific sites
// https://discourse.mozilla.org/t/block-javascript-on-specific-sites/19808
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
browser.webRequest.onHeadersReceived.addListener(
	function(details){
		//console.log(details);
		// include the original response header too merging the two arrays here
		var rh = details.responseHeaders.concat([{name: "Content-Security-Policy", value: "script-src 'none'"}]);
		return {responseHeaders: rh};
	},
	{urls: ["*://local.frontfoo.com/*"]},
	["blocking", "responseHeaders"]
);
