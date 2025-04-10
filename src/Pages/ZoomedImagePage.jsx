import React from "react";
import { useParams } from "react-router-dom";

const ZoomedImagePage = () => {
  const { imageId } = useParams();  // Fetch the imageId from URL params
  const image = getImageById(imageId);  // Get the image using the ID

  if (!image) {
    return <div>Image not found</div>; // Handle if the image is not found
  }

  return (
    <div className="zoomed-image-page">
      <h1 className="text-center text-2xl mb-4">Zoomed Image</h1>
      <div className="relative overflow-hidden w-full h-auto">
        <img
          src={image.src}
          alt={image.alt}
          className="transition-transform duration-300 transform hover:scale-150" // Tailwind zoom effect
        />
      </div>
    </div>
  );
};

// Example function to retrieve an image by ID, replace with actual logic
const getImageById = (id) => {
  const images = [
    { id: 1, src: "path_to_image_1.jpg", alt: "Image 1" },
    { id: 2, src: "path_to_image_2.jpg", alt: "Image 2" },
    { id: 3, src: "path_to_image_3.jpg", alt: "Image 3" },
  ];
  return images.find((image) => image.id === parseInt(id));
};

export default ZoomedImagePage;
