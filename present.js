const DEF_OPTS = {
	className: "present",
	cursor: "zoom-in",
	transition: 0.25,
	transitionFunc: "ease",
	size: 0.8,
	zIndex: 999999,
	backgroundOpacity: 0.9,
	wrap: true,
	caption: false,
}

function h(tag, props, children) {
	const el = document.createElement(tag)
	if (props) {
		for (const key in props) {
			el[key] = props[key]
		}
	}
	if (children !== undefined) {
		if (Array.isArray(children)) {
			for (const child of children) {
				if (child) el.appendChild(child)
			}
		} else if (children instanceof HTMLElement) {
			el.appendChild(children)
		} else if (typeof children === "string" || typeof children === "number") {
			el.textContent = children
		}
	}
	return el
}

function style(sheet) {
	return Object.entries(sheet)
		.map(([k, v]) => `${k}: ${v};`)
		.join("")
}

function forAll(selector, action) {
	document.querySelectorAll(selector).forEach(action)
	const observer = new MutationObserver((events) => {
		events.forEach((e) => {
			if (e.type !== "childList") return
			for (const node of e.addedNodes) {
				if (node.matches(selector)) {
					action(node)
				}
			}
		})
	})
	observer.observe(document.body, { childList: true, subtree: true })
	return () => observer.disconnect()
}

function mergeDefaults(obj, defaults) {
	const obj2 = { ...defaults }
	for (const k in obj) {
		obj2[k] = obj[k]
	}
	return obj2
}

function getRealRect(el) {
	const rect = el.getBoundingClientRect()
	const style = getComputedStyle(el)
	const pl = parseFloat(style.paddingLeft) || 0
	const pr = parseFloat(style.paddingRight) || 0
	const pt = parseFloat(style.paddingTop) || 0
	const pb = parseFloat(style.paddingBottom) || 0
	const bw = parseFloat(style.borderWidth) || 0
	rect.x += pl + bw
	rect.y += pt + bw
	rect.width -= (pl + pr + bw * 2)
	rect.height -= (pt + pb + bw * 2)
	return rect
}

export default function(userOpts = {}) {

	const opts = mergeDefaults(userOpts, DEF_OPTS)
	const cleanups = []
	let curPresenting = null
	const selector = `img.${opts.className}`

	cleanups.push(forAll(selector, apply))

	function cycle(n) {
		if (!curPresenting) return
		const scope = curPresenting.srcImg.dataset.presentScope
		if (!scope) return
		const imgs = document.querySelectorAll(`${selector}[data-present-scope="${scope}"]`)
		for (let i = 0; i < imgs.length; i++) {
			if (imgs[i] === curPresenting.srcImg) {
				let newIdx = i + n
				if (newIdx >= imgs.length) {
					newIdx = opts.wrap ? newIdx % imgs.length : imgs.length - 1
				} else if (newIdx < 0) {
					newIdx = opts.wrap ? imgs.length + newIdx % imgs.length : 0
				}
				const newSrcImg = imgs[newIdx]
				curPresenting.change(newSrcImg)
				return
			}
		}
	}

	const prev = () => cycle(-1)
	const next = () => cycle(1)

	const bodyEvents = {}
	const windowEvents = {}

	bodyEvents["keydown"] = (e) => {
		if (e.key === "Escape" || e.key === " ") {
			if (curPresenting) {
				e.preventDefault()
				close()
			}
		}
		if (e.key === "ArrowLeft") {
			e.preventDefault()
			prev()
		} else if (e.key === "ArrowRight") {
			e.preventDefault()
			next()
		}
	}

	bodyEvents["wheel"] = (e) => {
		if (!curPresenting) return
		e.preventDefault()
		// TODO: something like this
		// https://ilanablumberg.co.uk/Collections-Projects
	}

	bodyEvents["mousemove"] = (e) => {
		if (!curPresenting) return
		// TODO
	}

	windowEvents["resize"] = (e) => {
		if (!curPresenting) return
		curPresenting.update()
	}

	for (const ev in bodyEvents) {
		document.body.addEventListener(ev, bodyEvents[ev], { passive: false })
		cleanups.push(() => {
			document.body.removeEventListener(ev, bodyEvents[ev])
		})
	}

	for (const ev in windowEvents) {
		window.addEventListener(ev, windowEvents[ev], { passive: false })
		cleanups.push(() => {
			window.removeEventListener(ev, windowEvents[ev])
		})
	}

	function apply(img) {
		img.addEventListener("click", onclick)
		const oldCursor = img.style.cursor
		img.style.cursor = opts.cursor ?? "zoom-in"
		cleanups.push(() => {
			img.style.cursor = oldCursor
			img.removeEventListener("click", onclick)
		})
	}

	function present(srcImg) {

		if (curPresenting) return

		const srcRect = getRealRect(srcImg)

		const img = h("img", {
			src: srcImg.src,
			style: style({
				"position": "absolute",
				"left": `${srcRect.x}px`,
				"top": `${srcRect.y}px`,
				"width": `${srcRect.width}px`,
				"height": `${srcRect.height}px`,
				"transform-origin": "top left",
				"transition-property": "transform",
				"transition-duration": `${opts.transition}s`,
				"transition-timing-function": opts.transitionFunc,
				"transform": "translateZ(0)",
				"margin": "0",
				"padding": "0",
				"border": "none",
			}),
		})

		const backdrop = h("div", {
			style: style({
				"background-color": `rgba(0, 0, 0, 0)`,
				"z-index": opts.zIndex,
				"transition-property": "background-color",
				"transition-duration": `${opts.transition}s`,
				"transform": "translateZ(0)",
				"width": "100vw",
				"height": "100vh",
				"position": "fixed",
				"top": "0",
				"left": "0",
				"transition-timing-function": opts.transitionFunc,
				"margin": "0",
				"padding": "0",
				"border": "none",
			}),
			onclick: close,
		}, [
			img,
		])

		function calcDestRect() {
			const size = opts.size
			const ww = window.innerWidth
			const wh = window.innerHeight
			let iw = srcImg.width
			let ih = srcImg.height
			const r = iw / ih
			if (ww / wh >= r) {
				ih = wh * size
				iw = ih * r
			} else {
				iw = ww * size
				ih = iw / r
			}
			const x = (ww - iw) / 2
			const y = (wh - ih) / 2
			return {
				x: x,
				y: y,
				width: iw,
				height: ih,
			}
		}

		function change(newSrcImg) {
			srcImg = newSrcImg
			img.src = srcImg.src
			img.onload = update
			curPresenting.srcImg = srcImg
		}

		function update() {
			const destRect = calcDestRect()
			const srcRect = getRealRect(srcImg)
			const dx = destRect.x - srcRect.x
			const dy = destRect.y - srcRect.y
			const s = destRect.width / srcRect.width
			img.style["left"] = `${srcRect.x}px`
			img.style["top"] = `${srcRect.y}`
			img.style["width"] = `${srcRect.width}px`
			img.style["height"] = `${srcRect.height}px`
			img.style["transform"] = `translate3d(${dx}px, ${dy}px, 0) scale(${s})`
		}

		setTimeout(() => {
			update()
			backdrop.style["background-color"] = `rgba(0, 0, 0, ${opts.backgroundOpacity})`
			setTimeout(() => {
				img.style["transition-duration"] = `0s`
			}, opts.transition * 1000)
		}, 0)

		let dragging = null

		img.addEventListener("mousedown", (e) => {
			e.preventDefault()
			// TODO
		})

		function dispose() {
			const srcRect = getRealRect(srcImg)
			img.style["transition-duration"] = `${opts.transition}s`
			img.style["transform"] = "translate3d(0, 0, 0) scale(1)"
			backdrop.style["background-color"] = `rgba(0, 0, 0, 0)`
			const self = curPresenting
			return new Promise((resolve) => {
				setTimeout(() => {
					if (curPresenting === self) {
						curPresenting = null
					}
					backdrop.remove()
					resolve()
				}, opts.transition * 1000)
			})
		}

		curPresenting = {
			dispose: dispose,
			update: update,
			change: change,
			srcImg: srcImg,
		}

		document.body.appendChild(backdrop)

	}

	function close() {
		curPresenting?.dispose()
	}

	function onclick(e) {
		present(e.target)
	}

	function stop() {
		close()
		cleanups.forEach((f) => f())
	}

	function isPresenting() {
		return Boolean(curPresenting)
	}

	return {
		apply,
		present,
		close,
		prev,
		next,
		stop,
		isPresenting,
		curPresenting: () => curPresenting,
	}

}
