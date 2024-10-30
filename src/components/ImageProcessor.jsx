// src/components/ImageProcessor.jsx

import React, { useState, useEffect } from "react";
import SmartCrop from "smartcrop";
import { format } from "date-fns";
import "./ImageProcessor.css";

const ImageProcessor = () => {
  const [inputFiles, setInputFiles] = useState([]); // { file, previewUrl }
  const [outputFiles, setOutputFiles] = useState([]); // { file, blobUrl }
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Revocar todos los Blob URLs en outputFiles
  const revokeAllBlobUrls = () => {
    outputFiles.forEach((fileObj) => {
      URL.revokeObjectURL(fileObj.blobUrl);
    });
  };

  // Revocar todos los Preview URLs en inputFiles
  const revokeAllPreviewUrls = () => {
    inputFiles.forEach((fileObj) => {
      URL.revokeObjectURL(fileObj.previewUrl);
    });
  };

  useEffect(() => {
    // Limpiar URLs al desmontar el componente
    return () => {
      revokeAllBlobUrls();
      revokeAllPreviewUrls();
    };
  }, [outputFiles, inputFiles]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      revokeAllBlobUrls();
      revokeAllPreviewUrls();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      revokeAllBlobUrls();
      revokeAllPreviewUrls();
    };
  }, [outputFiles, inputFiles]);

  const handleFileChange = (e) => {
    // Revocar antiguos Preview URLs
    revokeAllPreviewUrls();

    const files = Array.from(e.target.files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setInputFiles(files);
    setOutputFiles([]);
    setMessages([]);
  };

  const processSingleImage = (fileObj, index, currentDate) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.readAsDataURL(fileObj.file);

      reader.onload = async () => {
        const img = new Image();
        img.src = reader.result;

        img.onload = async () => {
          try {
            const cropResult = await SmartCrop.crop(img, {
              width: 650,
              height: 434,
            });
            const crop = cropResult.topCrop;

            // Crear un canvas para aplicar el recorte y redimensionamiento
            const canvas = document.createElement("canvas");
            canvas.width = 650;
            canvas.height = 434;
            const ctx = canvas.getContext("2d");

            // Dibujar la región recortada en el canvas y redimensionar
            ctx.drawImage(
              img,
              crop.x,
              crop.y,
              crop.width,
              crop.height,
              0,
              0,
              650,
              434
            );

            // Convertir el canvas a un Blob en formato WebP
            const blob = await new Promise((resolveCanvas) => {
              canvas.toBlob(
                (blobResult) => {
                  resolveCanvas(blobResult);
                },
                "image/webp",
                0.8 // Calidad de compresión
              );
            });

            if (!blob) {
              throw new Error("No se pudo crear el blob de la imagen.");
            }

            // Generar el nombre del archivo de salida
            const timestamp = format(new Date(), "yyyyMMddHHmmss");
            const outputFilename = `rioyi-dev-${currentDate}-${timestamp}-${index}-${fileObj.file.name.replace(
              /\.[^/.]+$/,
              ""
            )}.webp`;

            // Crear un objeto File para la imagen procesada
            const outputFile = new File([blob], outputFilename, {
              type: "image/webp",
            });

            // Crear un Blob URL para la imagen procesada
            const blobUrl = URL.createObjectURL(outputFile);

            // Agregar el archivo procesado y su Blob URL al array de archivos procesados
            resolve({ file: outputFile, blobUrl });
          } catch (error) {
            console.error(
              `Error procesando la imagen ${fileObj.file.name}: ${error.message}`
            );
            setMessages((prev) => [
              ...prev,
              `❌ Error al procesar ${fileObj.file.name}: ${error.message}`,
            ]);
            resolve(null);
          }
        };

        img.onerror = () => {
          console.error(`Error cargando la imagen ${fileObj.file.name}`);
          setMessages((prev) => [
            ...prev,
            `❌ Error cargando la imagen ${fileObj.file.name}`,
          ]);
          resolve(null);
        };
      };

      reader.onerror = () => {
        console.error(`Error leyendo el archivo ${fileObj.file.name}`);
        setMessages((prev) => [
          ...prev,
          `❌ Error leyendo el archivo ${fileObj.file.name}`,
        ]);
        resolve(null);
      };
    });
  };

  const processImages = async () => {
    if (inputFiles.length === 0) {
      setMessages((prev) => [
        ...prev,
        "❌ Debes seleccionar al menos una imagen.",
      ]);
      return;
    }

    setLoading(true);
    const currentDate = format(new Date(), "yyyy-MM-dd");
    const processedFiles = [];

    const promises = inputFiles.map((fileObj, index) =>
      processSingleImage(fileObj, index, currentDate)
    );

    const results = await Promise.all(promises);

    results.forEach((result) => {
      if (result) {
        processedFiles.push(result);
        setMessages((prev) => [...prev, `✅ Procesado: ${result.file.name}`]);
      }
    });

    setOutputFiles([...processedFiles]);
    setLoading(false);
  };

  const downloadAll = () => {
    outputFiles.forEach((fileObj) => {
      const link = document.createElement("a");
      link.href = fileObj.blobUrl;
      link.download = fileObj.file.name;
      link.click();
      URL.revokeObjectURL(fileObj.blobUrl); // Revocar el Blob URL después de la descarga
    });
    setOutputFiles([]); // Limpiar el estado de archivos procesados
  };

  return (
    <div className="processor-container">
      <div className="section">
        <h1>Procesador de Imágenes</h1>
        <div className="file-input-container">
          <div className="input-file buttons">
            <p>Arrastre y suelte sus archivos aquí</p>
            <div className="input-file-button button">Seleccionar archivos</div>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="file-input buttons"
          />
        </div>
        {outputFiles.length && messages.length > 0 ? (
          <div className="messages">
            <ul>
              {messages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {inputFiles.length && !outputFiles.length ? (
          <div className="messages">
            <ul>
              {inputFiles.map((fileObj, idx) => (
                <li key={idx}>🔘 Archivo a procesar: {fileObj.file.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {inputFiles.length || outputFiles.length ? (
        <div className="section">
          {/* Sección de Previsualización de Imágenes Seleccionadas */}
          {inputFiles.length && !outputFiles.length ? (
            <>
              <div className="previews">
                <h2>Previsualización de Imágenes Seleccionadas</h2>
                <div className="images-grid">
                  {inputFiles.map((fileObj, idx) => (
                    <div key={idx} className="image-card">
                      <img
                        src={fileObj.previewUrl}
                        alt={fileObj.file.name}
                        className="preview-image"
                      />
                      <p>{fileObj.file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="buttons">
                <button
                  onClick={processImages}
                  disabled={loading}
                  className="button"
                >
                  {loading ? "Procesando..." : "Procesar Imágenes"}
                </button>
              </div>
            </>
          ) : null}

          {outputFiles.length ? (
            <div className="section">
              <div className="processed-images">
                <h2>Imágenes Procesadas</h2>
                <div className="images-grid">
                  {outputFiles.map((fileObj, idx) => (
                    <div key={idx} className="image-card">
                      <img
                        src={fileObj.blobUrl}
                        alt={fileObj.file.name}
                        className="processed-image"
                      />
                      <p>{fileObj.file.name}</p>
                      <a
                        href={fileObj.blobUrl}
                        download={fileObj.file.name}
                        className="download-link"
                      >
                        Descargar
                      </a>
                    </div>
                  ))}
                </div>
              </div>
              <div className="buttons">
                {outputFiles.length > 0 && (
                  <button
                    onClick={downloadAll}
                    disabled={loading}
                    className="button"
                  >
                    Descargar Todas
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ImageProcessor;
