const DEF_OPTS = {
	className: "imgbig",
	cursor: "zoom-in",
	transition: 0.25,
	transitionFunc: "ease",
	size: 0.8,
	zIndex: 999999,
	backgroundOpacity: 0.9,
	navigate: true,
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

function merge(a, b) {
	const obj = { ...a }
	for (const k in b) {
		obj[k] = b[k]
	}
	return obj
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

export default function init(userOpts = {}) {

	const opts = merge(DEF_OPTS, userOpts)
	const cleanups = []
	let curShowing = null
	const selector = `img.${opts.className}`

	cleanups.push(forAll(selector, apply))

	function prev() {
		if (!curShowing) return
		const imgs = document.querySelectorAll(selector)
		for (let i = 0; i < imgs.length; i++) {
			if (imgs[i] === curShowing.srcImg) {
				const newSrcImg = imgs[i === 0 ? imgs.length - 1 : i - 1]
				curShowing.change(newSrcImg)
				return
			}
		}
	}

	function next() {
		if (!curShowing) return
		const imgs = document.querySelectorAll(selector)
		for (let i = 0; i < imgs.length; i++) {
			if (imgs[i] === curShowing.srcImg) {
				const newSrcImg = imgs[(i + 1) % imgs.length]
				curShowing.change(newSrcImg)
				return
			}
		}
	}

	const bodyEvents = {}
	const windowEvents = {}

	bodyEvents["keydown"] = (e) => {
		if (e.key === "Escape" || e.key === " ") {
			if (curShowing) {
				e.preventDefault()
				close()
			}
		}
		if (opts.navigate) {
			if (e.key === "ArrowLeft") {
				e.preventDefault()
				prev()
			} else if (e.key === "ArrowRight") {
				e.preventDefault()
				next()
			}
		}
	}

	bodyEvents["wheel"] = (e) => {
		if (!curShowing) return
		e.preventDefault()
		// TODO: something like this
		// https://ilanablumberg.co.uk/Collections-Projects
	}

	windowEvents["resize"] = (e) => {
		if (!curShowing) return
		curShowing.update()
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

		if (curShowing) return

		const srcRect = getRealRect(srcImg)

		const img = h("img", {
			src: srcImg.src,
			style: style({
				"position": "absolute",
				"left": `${srcRect.x}px`,
				"top": `${srcRect.y}px`,
				"width": `${srcRect.width}px`,
				"height": `${srcRect.height}px`,
				"transition-duration": `${opts.transition}s`,
				"transition-timing-function": opts.transitionFunc,
				"margin": "0",
				"padding": "0",
				"border": "none",
			}),
		})

		const filter = h("div", {
			style: style({
				"background-color": `rgba(0, 0, 0, 0)`,
				"z-index": opts.zIndex,
				"transition-property": "background-color",
				"transition-duration": `${opts.transition}s`,
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

		function calcRect() {
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
			curShowing.srcImg = srcImg
		}

		function update() {
			const { x, y, width, height } = calcRect()
			img.style["left"] = `${x}px`
			img.style["top"] = `${y}`
			img.style["width"] = `${width}px`
			img.style["height"] = `${height}px`
		}

		setTimeout(() => {
			update()
			filter.style["background-color"] = `rgba(0, 0, 0, ${opts.backgroundOpacity})`
			setTimeout(() => {
				img.style["transition-duration"] = `0s`
			}, opts.transition * 1000)
		}, 0)

		function dispose() {
			const srcRect = getRealRect(srcImg)
			img.style["transition-duration"] = `${opts.transition}s`
			img.style["left"] = `${srcRect.x}px`
			img.style["top"] = `${srcRect.y}`
			img.style["width"] = `${srcRect.width}px`
			img.style["height"] = `${srcRect.height}px`
			filter.style["background-color"] = `rgba(0, 0, 0, 0)`
			return new Promise((resolve) => {
				setTimeout(() => {
					// TODO: rapidly clicking yields error
					filter.remove()
					curShowing = null
					resolve()
				}, opts.transition * 1000)
			})
		}

		curShowing = {
			dispose: dispose,
			update: update,
			change: change,
			srcImg: srcImg,
		}

		document.body.appendChild(filter)

	}

	function close() {
		curShowing?.dispose()
	}

	function onclick(e) {
		present(e.target)
	}

	function stop() {
		close()
		cleanups.forEach((f) => f())
	}

	return {
		apply,
		present,
		close,
		prev,
		next,
		stop,
	}

}
