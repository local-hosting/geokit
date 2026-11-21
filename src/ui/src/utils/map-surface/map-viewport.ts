export interface MapViewportLike {
  on(type: string, listener: () => void): void;
  off(type: string, listener: () => void): void;
}

/**
 * Invoke a callback when the map viewport stops changing after drag, zoom, rotate, pitch, or resize.
 * Returns a cleanup function that removes all listeners.
 */
export function onMapViewportSettled(
  map: MapViewportLike,
  onSettled: () => void
): () => void {
  let isDragging = false;

  const handleInteractionEnd = () => {
    if (!isDragging) {
      onSettled();
    }
  };

  const onDragStart = () => {
    isDragging = true;
  };

  const onDragEnd = () => {
    isDragging = false;
    handleInteractionEnd();
  };

  map.on('dragstart', onDragStart);
  map.on('dragend', onDragEnd);
  map.on('moveend', handleInteractionEnd);
  map.on('zoomend', handleInteractionEnd);
  map.on('rotateend', handleInteractionEnd);
  map.on('pitchend', handleInteractionEnd);
  map.on('resize', handleInteractionEnd);

  return () => {
    map.off('dragstart', onDragStart);
    map.off('dragend', onDragEnd);
    map.off('moveend', handleInteractionEnd);
    map.off('zoomend', handleInteractionEnd);
    map.off('rotateend', handleInteractionEnd);
    map.off('pitchend', handleInteractionEnd);
    map.off('resize', handleInteractionEnd);
  };
}
