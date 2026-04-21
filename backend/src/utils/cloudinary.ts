type UploadResult = {
  url: string;
};

const sanitizeName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const uploadImage = async (file: string, index: number): Promise<UploadResult> => {
  // If the file is a data URL (from frontend file upload), store it directly
  if (typeof file === "string" && file.startsWith("data:")) {
    console.log(`[uploadImage] Storing data URL directly for image ${index + 1}`);
    return {
      url: file,
    };
  }

  // Otherwise, generate a placeholder URL (for seeded data or other sources)
  const baseName = sanitizeName(file) || `image-${index + 1}`;
  console.log(`[uploadImage] Generating placeholder URL for image ${index + 1}: ${baseName}`);

  return {
    url: `https://mock-cloudinary.unibid-exchange.local/${Date.now()}-${index + 1}-${baseName}.jpg`,
  };
};

export const uploadImages = async (files: string[]): Promise<string[]> => {
  console.log(`[uploadImages] Processing ${files.length} images`);
  const uploads = await Promise.all(files.map((file, index) => uploadImage(file, index)));
  return uploads.map((item) => item.url);
};
