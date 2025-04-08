import React from "react";
import { Link } from "react-router-dom";

const ImageGallery = () => {
  const images = [
    { id: 1, src: "path_to_image_1.jpg", alt: "Image 1" },
    { id: 2, src: "path_to_image_2.jpg", alt: "Image 2" },
    { id: 3, src: "path_to_image_3.jpg", alt: "Image 3" },
    // Add more images here
  ];

  return (
    <div className="image-gallery grid grid-cols-3 gap-4">
      {images.map((image) => (
        <Link to={`/zoomed-image/${image.id}`} key={image.id}>
          <div className="image-item cursor-pointer">
            <img
              src={image.src}
              alt={image.alt}
              className="transition-transform duration-300 transform hover:scale-110" // Tailwind zoom effect
            />
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ImageGallery;
