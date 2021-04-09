import * as React from "react";
import * as ReactDOM from "react-dom";
import JSZip from "../node_modules/jszip/dist/jszip.min.js";

declare function require(path: string): any;
const FIGMA_JSON_NAME = "interface";

const App: React.FC = () => {
  textbox: HTMLInputElement;

  const typedArrayToBuffer = (array) => {
    return array.buffer.slice(
      array.byteOffset,
      array.byteLength + array.byteOffset
    );
  };

  const exportTypeToBlobType = (type: string) => {
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
  };

  const exportTypeToFileExtension = (type: string) => {
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
  };

  window.onmessage = async (event) => {
    if (!event.data.pluginMessage) return;

    const { exportableBytes, exportJSON } = event.data.pluginMessage;

    return new Promise<void>((resolve) => {
      let zip = new JSZip();
      let manifest = { figmaJson: `${FIGMA_JSON_NAME}.json`, screenImages: [] };

      // Export JSON details
      const json = JSON.stringify(exportJSON, null, 2);
      let jsonblob = new Blob([json], { type: exportTypeToBlobType("JSON") });
      zip.file(`${FIGMA_JSON_NAME}.json`, jsonblob, { base64: true });

      for (let data of exportableBytes) {
        const { bytes, name, setting } = data;
        const cleanBytes = typedArrayToBuffer(bytes);
        const type = exportTypeToBlobType(setting.format);
        const extension = exportTypeToFileExtension(setting.format);
        let blob = new Blob([cleanBytes], { type });
        zip.file(`${name}${setting.suffix}${extension}`, blob, {
          base64: true,
        });
        manifest.screenImages = [
          ...manifest.screenImages,
          `${name}${setting.suffix}${extension}`,
        ];
      }

      const manifestJSON = JSON.stringify(manifest, null, 2);
      let manifestBlob = new Blob([manifestJSON], {
        type: exportTypeToBlobType("JSON"),
      });
      zip.file(`manifest.json`, manifestBlob, { base64: true });

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
      window.parent.postMessage(
        { pluginMessage: { type: "zip-success" } },
        "*"
      );
    });
  };

  const handleExport = () => {
    parent.postMessage({ pluginMessage: { type: "start-export" } }, "*");
  };

  return (
    <div>
      <div>This is what will be exported</div>
      <button onClick={handleExport}>Export</button>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));