const DEF_CLASSNAME = "imgbig"
const DEF_BACKGROUND_OPACITY = 0.9
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

class Registry extends Map {
	lastID = 0
	push(v) {
		const id = this.lastID
		this.set(id, v)
		this.lastID++
		return id
	}
	pushd(v) {
		const id = this.push(v)
		return () => this.delete(id)
	}
}

export default function init(opts = {}) {

	const className = opts.className ?? DEF_CLASSNAME
	const cleanups = []
	let curShowing = null
	const imgs = document.querySelectorAll(`.${className}`)

	for (const img of imgs) {
		if (img.tagName === "IMG") {
			apply(img)
		}
	}

	const observer = new MutationObserver((events) => {
		events.forEach((e) => {
			if (e.type !== "childList") return
			for (const node of e.addedNodes) {
				if (node.tagName === "IMG" && node.classList.contains(className)) {
					apply(node)
				}
			}
		})
	})

	observer.observe(document.body, { childList: true, subtree: true })

	const wheelEvents = new Registry()
	const resizeEvents = new Registry()

	function prev() {
		if (!curShowing) return
		const imgs = document.querySelectorAll(`.${className}`)
		for (let i = 0; i < imgs.length; i++) {
			if (imgs[i] === curShowing.srcImg) {
				const nimg = imgs[i === 0 ? imgs.length - 1 : i - 1]
				curShowing.change(nimg)
				return
			}
		}
	}

	function next() {
		if (!curShowing) return
		const imgs = document.querySelectorAll(`.${className}`)
		for (let i = 0; i < imgs.length; i++) {
			if (imgs[i] === curShowing.srcImg) {
				const nimg = imgs[(i + 1) % imgs.length]
				curShowing.change(nimg)
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
		wheelEvents.forEach((f) => f(e))
	}

	bodyEvents["touchend"] = (e) => {
		console.log(e)
	}

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

	// TODO: name
	function apply(img) {
		img.addEventListener("click", onclick)
		const oldCursor = img.style.cursor
		img.style.cursor = opts.cursor ?? "zoom-in"
		cleanups.push(() => {
			img.style.cursor = oldCursor
			img.removeEventListener("click", onclick)
		})
	}

	function getRealRect(el) {
		const rect = el.getBoundingClientRect()
		const style = getComputedStyle(el)
		const pl = parseFloat(style.paddingLeft)
		const pr = parseFloat(style.paddingRight)
		const pt = parseFloat(style.paddingTop)
		const pb = parseFloat(style.paddingBottom)
		rect.x += pl
		rect.y += pt
		rect.width -= (pl + pr)
		rect.height -= (pt + pb)
		return rect
	}

	// TODO: name
	function bigify(srcImg) {

		if (curShowing) return

		const cleanups2 = []
		const transition = opts.transition ?? DEF_TRANSITION
		const srcRect = getRealRect(srcImg)

		const img = h("img", {
			src: srcImg.src,
			style: style({
				"position": "absolute",
				"left": `${srcRect.x}px`,
				"top": `${srcRect.y}px`,
				"width": `${srcRect.width}px`,
				"height": `${srcRect.height}px`,
				"transition": `${transition}s`,
				"margin": "0",
				"padding": "0 !important",
				"box-sizing": "border-box",
			}),
		})

		const filter = h("div", {
			style: style({
				"background": `rgba(0, 0, 0, 0)`,
				"z-index": opts.zIndex ?? DEF_ZINDEX,
				"transition": `background ${transition}s`,
				"margin": "0",
				"padding": "0",
				"width": "100vw",
				"height": "100vh",
				"position": "fixed",
				"top": "0",
				"left": "0",
				"box-sizing": "border-box",
			}),
			onclick: close,
		}, [
			img,
		])

		function calcRect() {
			const size = opts.size ?? DEF_SIZE
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
			filter.style["background"] = `rgba(0, 0, 0, ${opts.backgroundOpacity ?? DEF_BACKGROUND_OPACITY})`
			setTimeout(() => {
				img.style["transition"] = `0s`
			}, transition * 1000)
		}, 0)

		cleanups2.push(resizeEvents.pushd(update))

		cleanups2.push(wheelEvents.pushd((e) => {
			e.preventDefault()
			// TODO: something like this
			// https://ilanablumberg.co.uk/Collections-Projects
		}))

		function dispose() {
			const srcRect = getRealRect(srcImg)
			img.style["transition"] = `${transition}s`
			img.style["left"] = `${srcRect.x}px`
			img.style["top"] = `${srcRect.y}`
			img.style["width"] = `${srcRect.width}px`
			img.style["height"] = `${srcRect.height}px`
			filter.style["background"] = `rgba(0, 0, 0, 0)`
			cleanups2.forEach((f) => f())
			return new Promise((resolve) => {
				setTimeout(() => {
					// TODO: rapidly clicking yields error
					filter.parentNode.removeChild(filter)
					curShowing = null
					resolve()
				}, transition * 1000)
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
		bigify(e.target)
	}

	function stop() {
		close()
		observer.disconnect()
		cleanups.forEach((f) => f())
	}

	return {
		apply,
		bigify,
		close,
		stop,
		prev,
		next,
	}

}
