const DEF_CLASSNAME = "imgbig"
const DEF_BACKGROUND_OPACITY = 0.9
const DEF_BACKGROUND = `rgba(0, 0, 0, ${DEF_BACKGROUND_OPACITY})`
const DEF_SIZE = 0.8
const DEF_ZINDEX = 999999
const DEF_TRANSITION = 0.25

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

export default function init(opts = {}) {

	const className = opts.className ?? DEF_CLASSNAME
	const cleanups = []
	let curShowing = null
	const imgs = document.querySelectorAll(`.${className}`)

	for (const img of imgs) {
		if (img.tagName === "IMG") {
			make(img)
		}
	}

	const observer = new MutationObserver((events) => {
		events.forEach((e) => {
			if (e.type !== "childList") return
			for (const node of e.addedNodes) {
				if (node.tagName === "IMG" && node.classList.contains(className)) {
					make(node)
				}
			}
		})
	})

	observer.observe(document.body, { childList: true, subtree: true })

	function prev() {}
	function next() {}

	const bodyEvents = {}
	const windowEvents = {}

	bodyEvents["keydown"] = (e) => {
		if (e.key === "Escape") {
			close()
		} else if (e.key === "ArrowLeft") {
			prev()
		} else if (e.key === "ArrowRight") {
			next()
		}
	}

	// TODO
	bodyEvents["wheel"] = (e) => {
		if (curShowing) {
			e.preventDefault()
		}
	}

	const resizeEvents = []

	windowEvents["resize"] = (e) => {
		resizeEvents.forEach((f) => f(e))
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

	function make(img) {
		img.addEventListener("click", onclick)
		if (opts.cursor !== false) {
			img.style.cursor = opts.cursor ?? "zoom-in"
		}
		cleanups.push(() => {
			img.removeEventListener("click", onclick)
		})
	}

	function bigify(img) {

		if (curShowing) return

		const transition = opts.transition ?? DEF_TRANSITION
		const rect = img.getBoundingClientRect()

		const img2 = h("img", {
			src: img.src,
			style: style({
				"position": "absolute",
				"left": `${rect.x}px`,
				"top": `${rect.y}px`,
				"width": `${rect.width}px`,
				"height": `${rect.height}px`,
				"transition": `${transition}s`,
			}),
		})

		const filter = h("div", {
			style: style({
				"background": `rgba(0, 0, 0, 0)`,
				"z-index": opts.zIndex ?? DEF_ZINDEX,
				"transition": `background ${transition}s`,
				"width": "100vw",
				"height": "100vh",
				"position": "fixed",
				"top": "0",
				"left": "0",
			}),
			onclick: close,
		}, [
			img2,
		])

		function calcRect() {
			const ww = window.innerWidth
			const wh = window.innerHeight
			const r = rect.width / rect.height
			let iw = rect.width
			let ih = rect.height
			const size = opts.size ?? DEF_SIZE
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

		function update() {
			const { x, y, width, height } = calcRect()
			img2.style["left"] = `${x}px`
			img2.style["top"] = `${y}`
			img2.style["width"] = `${width}px`
			img2.style["height"] = `${height}px`
		}

		setTimeout(() => {
			update()
			filter.style["background"] = `rgba(0, 0, 0, ${opts.backgroundOpacity ?? DEF_BACKGROUND_OPACITY})`
			setTimeout(() => {
				img2.style["transition"] = `0s`
			}, transition * 1000)
			resizeEvents.push(update)
		}, 0)

		function dispose() {
			img2.style["left"] = `${rect.x}px`
			img2.style["top"] = `${rect.y}`
			img2.style["width"] = `${rect.width}px`
			img2.style["height"] = `${rect.height}px`
			img2.style["transition"] = `${transition}s`
			filter.style["background"] = `rgba(0, 0, 0, 0)`
			setTimeout(() => {
				filter.parentNode.removeChild(filter)
			}, transition * 1000)
		}

		curShowing = {
			dispose: dispose,
		}

		document.body.appendChild(filter)

	}

	function close() {
		if (!curShowing) return
		curShowing.dispose()
		curShowing = null
	}

	function onclick(e) {
		bigify(e.target)
	}

	function stop() {
		close()
		observer.disconnect()
		cleanups.forEach((f) => f())
	}

	return {
		make,
		bigify,
		close,
		stop,
		prev,
		next,
	}

}
