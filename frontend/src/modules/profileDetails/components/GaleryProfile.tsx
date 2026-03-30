'use client';

import { Badge } from '@/components/ui/badge';
import { ImageModal } from '@/components/ui/image-modal';
import { Camera, ChevronRight, Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

export const ProfileGallery = ({
  images,
  verified,
  name,
  isIdentityVerified = false,
}: {
  images: string[];
  verified: boolean;
  name: string;
  isIdentityVerified?: boolean;
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-carousel every 4 seconds (stops when modal is open or if only 1 image)
  useEffect(() => {
    if (!images || images.length <= 1 || isModalOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSelectedImage((prev) => (prev + 1) % images.length);
    }, 6000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [images, images?.length, isModalOpen]);

  const scrollToTrustFactors = () => {
    const trustSection = document.getElementById('trust-factors');
    if (trustSection) {
      trustSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in-50 slide-in-from-left-4 duration-500">
      {/* Identity Verification Banner */}
      {isIdentityVerified && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5" />
              </div>
              <div className="flex-1">
                <h3 className="text-md font-semibold text-green-800 dark:text-green-200 mb-1">
                  La identidad del usuario ha sido confirmada
                </h3>

              </div>
            </div>
            <button
              onClick={scrollToTrustFactors}
              className="flex items-center space-x-1 text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition-colors duration-200 text-sm font-medium whitespace-nowrap ml-4"
            >
              <span>Ver más</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Image */}
      <div className="relative w-full flex justify-center bg-black/10 rounded-xl overflow-hidden group cursor-pointer"
        onClick={() => {
          setModalImageIndex(selectedImage);
          setIsModalOpen(true);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Image
          width={600}
          height={700}
          src={images[selectedImage] || '/placeholder.svg'}
          alt={`${name} - Imagen ${selectedImage + 1}`}
          className="
      h-auto 
      max-h-[700px] 
      w-auto 
      max-w-full 
      object-contain 
      group-hover:scale-105 
      transition-transform 
      duration-500
    "
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Hover Overlay with Magnifying Glass */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Search className="h-8 w-8 text-white" />
          </div>
        </div>

        {verified && (
          <Badge className="absolute top-4 left-4 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 z-10">
            <Camera className="h-3 w-3 mr-1" />
            Fotos verificadas
          </Badge>
        )}
      </div>

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-4 gap-2 ">
        {images.map((image, index) => (
          <button
            type="button"
            key={index + image}
            onClick={() => {
              setSelectedImage(index);
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative overflow-hidden rounded-lg aspect-square group transition-all duration-200 h-20 md:h-36 ${selectedImage === index
              ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-background'
              : 'hover:ring-2 hover:ring-purple-300 hover:ring-offset-2 hover:ring-offset-background'
              }`}
          >
            <Image
              width={400}
              height={400}
              src={image || '/placeholder.svg'}
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-200" />
          </button>
        ))}
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        images={images}
        currentIndex={modalImageIndex}
        onIndexChange={(index) => {
          setModalImageIndex(index);
          setSelectedImage(index);
        }}
        alt={name}
      />
    </div>
  );
};
