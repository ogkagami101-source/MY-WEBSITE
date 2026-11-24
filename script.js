// Runs once the page has loaded.
console.log("Hello World");

const image = document.querySelector("main img");

const bus = document.querySelector(".bus");
const people = document.querySelector(".people");
const londonClock = document.querySelector("#london-clock");

const clipOutsideWhite = (image) => {
  const removeBackground = () => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      throw new Error(`Could not process image: ${image.currentSrc}`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Could not create a canvas context to process image backgrounds.");
    }

    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const pixelCount = width * height;
    const radius = Math.max(12, Math.round(width * 0.02));
    const ink = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let queueEnd = 0;
    let queueStart = 0;

    for (let index = 0; index < pixelCount; index += 1) {
      const offset = index * 4;
      if (
        pixels[offset] < 235 ||
        pixels[offset + 1] < 235 ||
        pixels[offset + 2] < 235
      ) {
        ink[index] = 1;
      }
    }

    const dilateInk = (mask) => {
      const horizontal = new Uint8Array(pixelCount);
      const expanded = new Uint8Array(pixelCount);

      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        let count = 0;
        for (let x = 0; x <= Math.min(radius, width - 1); x += 1) {
          count += mask[row + x];
        }

        for (let x = 0; x < width; x += 1) {
          horizontal[row + x] = count > 0 ? 1 : 0;
          const outgoing = x - radius;
          const incoming = x + radius + 1;
          if (outgoing >= 0) count -= mask[row + outgoing];
          if (incoming < width) count += mask[row + incoming];
        }
      }

      for (let x = 0; x < width; x += 1) {
        let count = 0;
        for (let y = 0; y <= Math.min(radius, height - 1); y += 1) {
          count += horizontal[y * width + x];
        }

        for (let y = 0; y < height; y += 1) {
          expanded[y * width + x] = count > 0 ? 1 : 0;
          const outgoing = y - radius;
          const incoming = y + radius + 1;
          if (outgoing >= 0) count -= horizontal[outgoing * width + x];
          if (incoming < height) count += horizontal[incoming * width + x];
        }
      }

      return expanded;
    };

    const erodeInk = (mask) => {
      const horizontal = new Uint8Array(pixelCount);
      const closed = new Uint8Array(pixelCount);
      const windowSize = radius * 2 + 1;

      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        let count = 0;
        for (let x = 0; x <= Math.min(radius, width - 1); x += 1) {
          count += mask[row + x];
        }

        for (let x = 0; x < width; x += 1) {
          horizontal[row + x] = count === windowSize ? 1 : 0;
          const outgoing = x - radius;
          const incoming = x + radius + 1;
          if (outgoing >= 0) count -= mask[row + outgoing];
          if (incoming < width) count += mask[row + incoming];
        }
      }

      for (let x = 0; x < width; x += 1) {
        let count = 0;
        for (let y = 0; y <= Math.min(radius, height - 1); y += 1) {
          count += horizontal[y * width + x];
        }

        for (let y = 0; y < height; y += 1) {
          closed[y * width + x] = count === windowSize ? 1 : 0;
          const outgoing = y - radius;
          const incoming = y + radius + 1;
          if (outgoing >= 0) count -= horizontal[outgoing * width + x];
          if (incoming < height) count += horizontal[incoming * width + x];
        }
      }

      return closed;
    };

    // Close small breaks in the hand-drawn outlines before removing outside white pixels.
    const closedInk = erodeInk(dilateInk(ink));

    const enqueueWhitePixel = (index) => {
      const offset = index * 4;
      if (
        closedInk[index] ||
        pixels[offset + 3] === 0 ||
        pixels[offset] < 235 ||
        pixels[offset + 1] < 235 ||
        pixels[offset + 2] < 235
      ) {
        return;
      }

      pixels[offset + 3] = 0;
      queue[queueEnd] = index;
      queueEnd += 1;
    };

    for (let x = 0; x < width; x += 1) {
      enqueueWhitePixel(x);
      enqueueWhitePixel((height - 1) * width + x);
    }

    for (let y = 0; y < height; y += 1) {
      enqueueWhitePixel(y * width);
      enqueueWhitePixel(y * width + width - 1);
    }

    while (queueStart < queueEnd) {
      const index = queue[queueStart];
      queueStart += 1;

      const x = index % width;
      if (x > 0) enqueueWhitePixel(index - 1);
      if (x < width - 1) enqueueWhitePixel(index + 1);
      if (index >= width) enqueueWhitePixel(index - width);
      if (index < width * (height - 1)) enqueueWhitePixel(index + width);
    }

    context.putImageData(imageData, 0, 0);
    image.src = canvas.toDataURL("image/png");
  };

  if (image.complete) {
    removeBackground();
  } else {
    image.addEventListener("load", removeBackground, { once: true });
  }
};

document.querySelectorAll(".bus, .people").forEach(clipOutsideWhite);

if (londonClock) {
  const londonTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const updateLondonClock = () => {
    const now = new Date();
    londonClock.textContent = londonTimeFormatter.format(now);
    londonClock.dateTime = now.toISOString();
  };

  updateLondonClock();
  window.setInterval(updateLondonClock, 1_000);
}

if (bus) {
  const startPeopleEntry = () => {
    if (people) {
      const busBounds = bus.getBoundingClientRect();
      people.style.setProperty(
        "--bus-center-y",
        `${busBounds.top + busBounds.height / 2}px`
      );

      const direction = Math.random() < 0.5
        ? "enter-from-left"
        : "enter-from-right";
      people.classList.add(direction);
    }
  };

  const stopPeople = () => {
    if (people) {
      people.classList.remove("enter-from-left", "enter-from-right");
      people.style.removeProperty("--bus-center-y");
    }
  };

  const startBusPass = () => {
    bus.classList.add("is-moving");

    window.setTimeout(startPeopleEntry, 3_000);
    window.setTimeout(stopPeople, 13_000);
  };

  window.setTimeout(startBusPass, 10_000);

  bus.addEventListener("animationend", () => {
    bus.classList.remove("is-moving");
    window.setTimeout(startBusPass, 0);
  });
}
