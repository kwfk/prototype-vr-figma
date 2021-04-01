// import './ui.css'
import JSZip from "../node_modules/jszip/dist/jszip.min.js";

// document.getElementById("create").onclick = () => {
//   const textbox = document.getElementById("count") as HTMLInputElement;
//   const count = parseInt(textbox.value, 10);
//   parent.postMessage(
//     { pluginMessage: { type: "create-rectangles", count } },
//     "*"
//   );
// };

// document.getElementById("cancel").onclick = () => {
//   parent.postMessage({ pluginMessage: { type: "cancel" } }, "*");
// };

function typedArrayToBuffer(array) {
  return array.buffer.slice(
    array.byteOffset,
    array.byteLength + array.byteOffset
  );
}

function exportTypeToBlobType(type: string) {
  switch (type) {
    case "PDF":
      return "application/pdf";
    case "SVG":
      return "image/svg+xml";
    case "PNG":
      return "image/png";
    case "JPG":
      return "image/jpeg";
    case "JSON":
      return "application/json";
    default:
      return "image/png";
  }
}

function exportTypeToFileExtension(type: string) {
  switch (type) {
    case "PDF":
      return ".pdf";
    case "SVG":
      return ".svg";
    case "PNG":
      return ".png";
    case "JPG":
      return ".jpg";
    case "JSON":
      return ".json";
    default:
      return ".png";
  }
}

window.onmessage = async (event) => {
  if (!event.data.pluginMessage) return;

  const { exportableBytes, exportJSON } = event.data.pluginMessage;

  return new Promise<void>((resolve) => {
    let zip = new JSZip();

    // Export JSON details
    const json = JSON.stringify(exportJSON, null, 2);
    let jsonblob = new Blob([json], { type: exportTypeToBlobType("JSON") });
    zip.file(`interface.json`, jsonblob, { base64: true });

    for (let data of exportableBytes) {
      const { bytes, name, setting } = data;
      const cleanBytes = typedArrayToBuffer(bytes);
      const type = exportTypeToBlobType(setting.format);
      const extension = exportTypeToFileExtension(setting.format);
      let blob = new Blob([cleanBytes], { type });
      zip.file(`${name}${setting.suffix}${extension}`, blob, { base64: true });
    }

    zip.generateAsync({ type: "blob" }).then((content: Blob) => {
      const blobURL = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.className = "button button--primary";
      link.href = blobURL;
      link.download = "export.fig2u";
      link.click();
      link.setAttribute("download", name + ".fig2u");
      resolve();
    });
  }).then(() => {
    window.parent.postMessage({ pluginMessage: "Done!" }, "*");
  });
};
