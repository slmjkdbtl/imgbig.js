const DEF_CLASSNAME = "imgbig"
const DEF_BACKGROUND_OPACITY = 0.8
const DEF_BACKGROUND = `rgba(0, 0, 0, ${DEF_BACKGROUND_OPACITY})`
const DEF_SIZE = 80

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

	function onkeydown(e) {
		if (e.key === "Escape") {
			close()
		}
	}

	document.body.addEventListener("keydown", onkeydown)

	cleanups.push(() => {
		document.body.removeEventListener("keydown", onkeydown)
	})

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
		const filter = h("div", {
			style: style({
				"background": opts.background ?? `rgba(0, 0, 0, ${opts.backgroundOpacity ?? DEF_BACKGROUND_OPACITY})`,
				"width": "100vw",
				"height": "100vh",
				"z-index": "1000",
				"position": "absolute",
				"top": "0",
				"left": "0",
				"display": "flex",
				"justify-content": "center",
				"align-items": "center",
			}),
			onclick: close,
		}, [
			h("img", {
				src: img.src,
				style: style({
					"object-fit": "contain",
					"width": `${opts.size ?? DEF_SIZE}%`,
					"height": `${opts.size ?? DEF_SIZE}%`,
				}),
			}),
		])
		curShowing = {
			filter: filter,
		}
		document.body.appendChild(filter)
	}

	function close() {
		if (!curShowing) return
		curShowing.filter.parentNode.removeChild(curShowing.filter)
		curShowing = null
	}

	function onclick(e) {
		bigify(e.target)
	}

	function stop() {
		close()
		cleanups.forEach((f) => f())
		observer.disconnect()
	}

	return {
		make,
		bigify,
		close,
		stop,
	}

}
