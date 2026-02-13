import justifiedLayout from 'justified-layout';
import { Fancybox } from '@fancyapps/ui';

export async function initGallery() {
  const container = document.getElementById('photo-grid');
  if (!container) {
    return;
  }

  const items = Array.from(container.querySelectorAll('.photo-item'));
  const spinner = document.getElementById('loading-spinner');
  const emptyState = document.getElementById('empty-state');

  if (items.length === 0) {
    if (spinner) spinner.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  // Load images to get natural dimensions
  const imgData = await Promise.all(items.map(item => {
    const img = item.querySelector('img') as HTMLImageElement;
    return new Promise<{width: number, height: number}>(resolve => {
      if (!img) return resolve({width: 300, height: 200});

      img.loading = 'eager';

      const resolveWithFallback = () => resolve({
        width: img.naturalWidth || 300,
        height: img.naturalHeight || 200
      });

      if (img.complete) {
        resolveWithFallback();
        return;
      }

      const timeout = setTimeout(resolveWithFallback, 3000);
      img.onload = () => {
        clearTimeout(timeout);
        resolveWithFallback();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve({width: 300, height: 200});
      };
    });
  }));

  // Calculate layout
  const layout = justifiedLayout(imgData, {
    containerWidth: container.clientWidth,
    targetRowHeight: 280,
    boxSpacing: 12,
    containerPadding: 0
  });

  // Apply layout
  container.style.height = `${layout.containerHeight}px`;
  items.forEach((item, i) => {
    const box = layout.boxes[i];
    if (!box) return;
    const element = item as HTMLElement;
    element.style.position = 'absolute';
    element.style.top = `${box.top}px`;
    element.style.left = `${box.left}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
    element.style.display = 'block';
  });

  // Hide spinner after layout is applied
  if (spinner) spinner.style.display = 'none';

  // Bind Fancybox to gallery items with very fast animations
  Fancybox.bind('[data-fancybox="gallery"]' as any, {
    speed: 50,  // Ultra fast animations (50ms)
    placeFocusBack: false,
    trapFocus: false
  } as any);
}

