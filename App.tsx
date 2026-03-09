import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './components/Button';
import { DesignBrief, AttachedFile, AttachedLink } from './types';
import { generateDesignBrief, generateSVGDesign, refineSVGDesign, generateSVGDirectly, ModelType, discoverTrendingIdea } from './services/geminiService';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GradientStop {
  id: string;
  offset: number;
  color: string;
}

const COMPONENT_PRESETS = [
  'Modern Flat Professional',
  'Glassmorphism UI Kit',
  'Bento Grid Layout',
  'Spatial UI (VisionOS)',
  'Cyberpunk HUD',
  'Bio-organic UI',
  'Neumorphism Pro',
  'Fintech Dark Mode',
  'Minimalist Dashboard',
  'SaaS Landing Page',
  'Mobile App UI Kit',
  'Realistic 3D UI Package',
  'UI Button Package'
];

const GRADIENT_PRESETS = [
  { name: 'Indigo Night', type: 'linear', angle: 135, stops: [{ offset: 0, color: '#4f46e5' }, { offset: 100, color: '#7c3aed' }] },
  { name: 'Sunset Glow', type: 'linear', angle: 90, stops: [{ offset: 0, color: '#f59e0b' }, { offset: 100, color: '#ef4444' }] },
  { name: 'Oceanic', type: 'linear', angle: 45, stops: [{ offset: 0, color: '#0ea5e9' }, { offset: 100, color: '#2563eb' }] },
  { name: 'Emerald Wave', type: 'linear', angle: 180, stops: [{ offset: 0, color: '#10b981' }, { offset: 100, color: '#059669' }] },
  { name: 'Cyber Neon', type: 'linear', angle: 90, stops: [{ offset: 0, color: '#ff00ff' }, { offset: 100, color: '#00ffff' }] },
  { name: 'Cosmic Radial', type: 'radial', angle: 0, stops: [{ offset: 0, color: '#7c3aed' }, { offset: 100, color: '#1e1b4b' }] },
  { name: 'Golden Hour', type: 'radial', angle: 0, stops: [{ offset: 0, color: '#fef08a' }, { offset: 100, color: '#ea580c' }] },
  { name: 'Deep Space', type: 'radial', angle: 0, stops: [{ offset: 0, color: '#312e81' }, { offset: 70, color: '#1e1b4b' }, { offset: 100, color: '#000000' }] },
  { name: 'Glass Highlight', type: 'linear', angle: 135, stops: [{ offset: 0, color: 'rgba(255,255,255,0.4)' }, { offset: 50, color: 'rgba(255,255,255,0.1)' }, { offset: 100, color: 'rgba(255,255,255,0.05)' }] },
];

const SHADOW_PRESETS = [
  { name: 'Soft Ambient', color: '#000000', opacity: 0.1, blur: 20, offsetX: 0, offsetY: 10 },
  { name: 'Sharp Direct', color: '#000000', opacity: 0.4, blur: 0, offsetX: 8, offsetY: 8 },
  { name: 'Floating', color: '#000000', opacity: 0.2, blur: 40, offsetX: 0, offsetY: 20 },
  { name: 'Inner Depth', color: '#000000', opacity: 0.5, blur: 15, offsetX: 0, offsetY: 0 },
  { name: 'Indigo Glow', color: '#6366f1', opacity: 0.3, blur: 25, offsetX: 0, offsetY: 5 },
];

export default function App() {
  const [brief, setBrief] = useState<DesignBrief | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [manualPrompt, setManualPrompt] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('Modern Flat Professional');
  const [pageSize, setPageSize] = useState<'web' | 'a4'>('web');
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-flash-preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'code'>('canvas');
  const [zoom, setZoom] = useState(1);
  const [isApiKeySelected, setIsApiKeySelected] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Forging vectors...');
  const [isCopied, setIsCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Selection & Inspector State
  const [selectedElements, setSelectedElements] = useState<SVGGraphicsElement[]>([]);
  const [fillType, setFillType] = useState<'solid' | 'gradient'>('solid');
  const [elementProps, setElementProps] = useState({
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    opacity: 1,
    textContent: ''
  });

  const [gradientProps, setGradientProps] = useState({
    type: 'linear' as 'linear' | 'radial',
    angle: 0,
    stops: [
      { id: '1', offset: 0, color: '#6366f1' },
      { id: '2', offset: 100, color: '#a855f7' }
    ] as GradientStop[]
  });

  const [glowProps, setGlowProps] = useState({
    enabled: false,
    color: '#6366f1',
    intensity: 0.5,
    blur: 10,
    spread: 2,
    type: 'outer' as 'inner' | 'outer'
  });

  const [shadowProps, setShadowProps] = useState({
    enabled: false,
    color: '#000000',
    opacity: 0.3,
    blur: 15,
    offsetX: 5,
    offsetY: 5
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [transformType, setTransformType] = useState<'move' | 'resize' | 'rotate' | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [initialBBox, setInitialBBox] = useState<BoundingBox | null>(null);
  const [initialTransforms, setInitialTransforms] = useState<{ el: SVGGraphicsElement, transform: string }[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElements.length > 0) {
        // Don't delete if user is typing in an input or textarea
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        
        selectedElements.forEach(el => el.remove());
        setSelectedElements([]);
        if (canvasRef.current) {
          const svg = canvasRef.current.querySelector('svg');
          if (svg) setSvgContent(svg.outerHTML);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements]);

  useEffect(() => {
    const checkKey = async () => {
      try {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.aistudio?.hasSelectedApiKey) {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsApiKeySelected(hasKey);
        }
      } catch (err) {
        console.warn("Key check failed", err);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.aistudio?.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setIsApiKeySelected(true);
        setSystemError(null);
      } else {
        setSystemError("API Key selection is not supported in this environment.");
      }
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const handle = target.closest('[data-handle]') as HTMLElement | null;
    const svgEl = target.closest('path, rect, circle, ellipse, text, g') as SVGGraphicsElement | null;

    if (handle && bbox) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialBBox({ ...bbox });
      setInitialTransforms(selectedElements.map(el => ({ el, transform: el.getAttribute('transform') || '' })));
      
      const type = handle.getAttribute('data-handle');
      if (type === 'rotate') {
        setTransformType('rotate');
      } else {
        setTransformType('resize');
        setResizeHandle(type as any);
      }
      return;
    }

    if (svgEl && svgEl.tagName !== 'svg') {
      let nextSelection = [...selectedElements];
      if (e.shiftKey) {
        if (nextSelection.includes(svgEl)) {
          nextSelection = nextSelection.filter(item => item !== svgEl);
        } else {
          nextSelection.push(svgEl);
        }
      } else {
        if (!nextSelection.includes(svgEl)) {
          nextSelection = [svgEl];
        }
      }
      setSelectedElements(nextSelection);

      // Start dragging
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setTransformType('move');
      setInitialBBox(null); // Will be calculated if needed
      
      const positions = nextSelection.map(el => {
        const transform = el.getAttribute('transform') || '';
        const m = transform.match(/translate\(([^,)]+),?\s*([^)]*)\)/);
        return {
          el,
          transform: transform // Store full transform for move too if we want to be consistent
        };
      });
      // Re-using initialTransforms for consistency
      setInitialTransforms(positions);
    } else {
      setSelectedElements([]);
      setIsDragging(false);
      setTransformType(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || selectedElements.length === 0) return;

    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;

    if (transformType === 'move') {
      initialTransforms.forEach(({ el, transform }) => {
        const m = transform.match(/translate\(([^,)]+),?\s*([^)]*)\)/);
        const tx = m ? parseFloat(m[1]) : 0;
        const ty = m ? parseFloat(m[2]) : 0;
        const rest = transform.replace(/translate\([^)]+\)\s*/, '');
        el.setAttribute('transform', `translate(${tx + dx}, ${ty + dy}) ${rest}`.trim());
      });
    } else if (transformType === 'resize' && initialBBox && resizeHandle) {
      const { x, y, width, height } = initialBBox;
      let newWidth = width;
      let newHeight = height;
      let newX = x;
      let newY = y;

      if (resizeHandle === 'se') {
        newWidth = Math.max(1, width + dx);
        newHeight = Math.max(1, height + dy);
      } else if (resizeHandle === 'sw') {
        newWidth = Math.max(1, width - dx);
        newHeight = Math.max(1, height + dy);
        newX = x + (width - newWidth);
      } else if (resizeHandle === 'ne') {
        newWidth = Math.max(1, width + dx);
        newHeight = Math.max(1, height - dy);
        newY = y + (height - newHeight);
      } else if (resizeHandle === 'nw') {
        newWidth = Math.max(1, width - dx);
        newHeight = Math.max(1, height - dy);
        newX = x + (width - newWidth);
        newY = y + (height - newHeight);
      }

      const scaleX = newWidth / width;
      const scaleY = newHeight / height;

      // Fixed point for scaling
      const fx = resizeHandle.includes('w') ? x + width : x;
      const fy = resizeHandle.includes('n') ? y + height : y;

      initialTransforms.forEach(({ el, transform }) => {
        // We apply scale relative to the fixed point
        // T(fx, fy) * S(sx, sy) * T(-fx, -fy) * InitialTransform
        const newTransform = `translate(${fx}, ${fy}) scale(${scaleX}, ${scaleY}) translate(${-fx}, ${-fy}) ${transform}`;
        el.setAttribute('transform', newTransform);
      });
    } else if (transformType === 'rotate' && initialBBox) {
      const centerX = initialBBox.x + initialBBox.width / 2;
      const centerY = initialBBox.y + initialBBox.height / 2;
      
      const startAngle = Math.atan2(dragStart.y - (centerY * zoom + canvasRef.current!.getBoundingClientRect().top + 12 * 4), dragStart.x - (centerX * zoom + canvasRef.current!.getBoundingClientRect().left + 12 * 4));
      // Actually simpler: just use mouse position relative to center
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / zoom - 48; // 48 is padding (p-12)
      const my = (e.clientY - rect.top) / zoom - 48;
      
      const angle = Math.atan2(my - centerY, mx - centerX) * (180 / Math.PI) + 90;

      initialTransforms.forEach(({ el, transform }) => {
        const newTransform = `rotate(${angle}, ${centerX}, ${centerY}) ${transform}`;
        el.setAttribute('transform', newTransform);
      });
    }

    // Update bbox manually for smooth feedback
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedElements.forEach((el: SVGGraphicsElement) => {
      try {
        const rect = el.getBBox();
        const svg = el.ownerSVGElement;
        if (svg) {
          // Get matrix from element to SVG coordinate system
          const elCTM = el.getScreenCTM();
          const svgCTM = svg.getScreenCTM();
          if (elCTM && svgCTM) {
            const matrix = svgCTM.inverse().multiply(elCTM);
            
            const points = [
              svg.createSVGPoint(), svg.createSVGPoint(),
              svg.createSVGPoint(), svg.createSVGPoint()
            ];
            points[0].x = rect.x; points[0].y = rect.y;
            points[1].x = rect.x + rect.width; points[1].y = rect.y;
            points[2].x = rect.x; points[2].y = rect.y + rect.height;
            points[3].x = rect.x + rect.width; points[3].y = rect.y + rect.height;
            
            points.forEach(p => {
              const pt = p.matrixTransform(matrix);
              minX = Math.min(minX, pt.x);
              minY = Math.min(minY, pt.y);
              maxX = Math.max(maxX, pt.x);
              maxY = Math.max(maxY, pt.y);
            });
          }
        }
      } catch (e) {
        const rect = el.getBBox();
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
      }
    });
    if (minX !== Infinity) setBbox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setTransformType(null);
      setResizeHandle(null);
      
      // Consolidate transforms to prevent bloat
      selectedElements.forEach(el => {
        try {
          const svg = el.ownerSVGElement;
          if (svg) {
            // This is a trick to let the browser consolidate the transform stack into a single matrix
            const transformList = el.transform.baseVal;
            if (transformList.numberOfItems > 1) {
              const consolidatedMatrix = transformList.consolidate()?.matrix;
              if (consolidatedMatrix) {
                el.setAttribute('transform', `matrix(${consolidatedMatrix.a}, ${consolidatedMatrix.b}, ${consolidatedMatrix.c}, ${consolidatedMatrix.d}, ${consolidatedMatrix.e}, ${consolidatedMatrix.f})`);
              }
            }
          }
        } catch (e) {}
      });

      // Finalize the SVG content state
      if (canvasRef.current) {
        const svg = canvasRef.current.querySelector('svg');
        if (svg) setSvgContent(svg.outerHTML);
      }
    }
  };

  useEffect(() => {
    if (selectedElements.length === 0) {
      setBbox(null);
      return;
    }

    const firstEl = selectedElements[0];
    const rawFill = firstEl.getAttribute('fill') || '#000000';
    
    // Fill/Gradient state recovery
    if (rawFill.startsWith('url(#')) {
      setFillType('gradient');
      const gradId = rawFill.match(/url\(#([^)]+)\)/)?.[1];
      if (gradId && canvasRef.current) {
        const gradEl = canvasRef.current.querySelector(`#${gradId}`);
        if (gradEl) {
          const type = gradEl.tagName.toLowerCase().includes('radial') ? 'radial' : 'linear';
          const stops: GradientStop[] = Array.from(gradEl.querySelectorAll('stop')).map((s: any, idx) => ({
            id: String(idx),
            offset: parseFloat(s.getAttribute('offset') || '0') * (s.getAttribute('offset')?.includes('%') ? 1 : 100),
            color: s.getAttribute('stop-color') || '#000000'
          }));
          
          let angle = 0;
          if (type === 'linear') {
            const x1 = parseFloat(gradEl.getAttribute('x1') || '0');
            const y1 = parseFloat(gradEl.getAttribute('y1') || '0');
            const x2 = parseFloat(gradEl.getAttribute('x2') || '100');
            const y2 = parseFloat(gradEl.getAttribute('y2') || '0');
            angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
          }
          setGradientProps({ type, stops, angle: Math.round(angle) });
        }
      }
    } else {
      setFillType('solid');
      setElementProps(prev => ({ ...prev, fill: rawFill }));
    }

    const stroke = firstEl.getAttribute('stroke') || 'none';
    const strokeWidth = parseFloat(firstEl.getAttribute('stroke-width') || '1');
    const opacity = parseFloat(firstEl.getAttribute('opacity') || '1');
    const textContent = firstEl.tagName === 'text' ? firstEl.textContent || '' : '';

    setElementProps(prev => ({ ...prev, stroke, strokeWidth, opacity, textContent }));
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedElements.forEach((el: SVGGraphicsElement) => {
      try {
        const rect = el.getBBox();
        const transform = el.getAttribute('transform') || '';
        const m = transform.match(/translate\(([^,)]+),?\s*([^)]*)\)/);
        const tx = m ? parseFloat(m[1]) : 0;
        const ty = m ? parseFloat(m[2]) : 0;
        minX = Math.min(minX, rect.x + tx);
        minY = Math.min(minY, rect.y + ty);
        maxX = Math.max(maxX, rect.x + rect.width + tx);
        maxY = Math.max(maxY, rect.y + rect.height + ty);
      } catch (e) {}
    });
    if (minX !== Infinity) setBbox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }, [selectedElements]);

  const updateSVGDefs = (id: string, type: 'linear' | 'radial', stops: GradientStop[], angle: number = 0) => {
    if (!canvasRef.current) return;
    const svg = canvasRef.current.querySelector('svg');
    if (!svg) return;

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.prepend(defs);
    }

    let gradEl = defs.querySelector(`#${id}`);
    if (gradEl) gradEl.remove();

    gradEl = document.createElementNS('http://www.w3.org/2000/svg', type === 'linear' ? 'linearGradient' : 'radialGradient');
    gradEl.setAttribute('id', id);
    gradEl.setAttribute('gradientUnits', 'userSpaceOnUse');

    if (type === 'linear') {
      const rad = (angle * Math.PI) / 180;
      gradEl.setAttribute('x1', `${50 - 50 * Math.cos(rad)}%`);
      gradEl.setAttribute('y1', `${50 - 50 * Math.sin(rad)}%`);
      gradEl.setAttribute('x2', `${50 + 50 * Math.cos(rad)}%`);
      gradEl.setAttribute('y2', `${50 + 50 * Math.sin(rad)}%`);
    } else {
      gradEl.setAttribute('cx', '50%');
      gradEl.setAttribute('cy', '50%');
      gradEl.setAttribute('r', '50%');
      gradEl.setAttribute('fx', '50%');
      gradEl.setAttribute('fy', '50%');
    }

    stops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', `${stop.offset}%`);
      stopEl.setAttribute('stop-color', stop.color);
      gradEl?.appendChild(stopEl);
    });

    defs.appendChild(gradEl);
    setSvgContent(svg.outerHTML);
  };

  const updateSVGFilter = (id: string, glow: typeof glowProps, shadow: typeof shadowProps) => {
    if (!canvasRef.current) return;
    const svg = canvasRef.current.querySelector('svg');
    if (!svg) return;

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.prepend(defs);
    }

    let filterEl = defs.querySelector(`#${id}`);
    if (filterEl) filterEl.remove();

    if (!glow.enabled && !shadow.enabled) return;

    filterEl = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filterEl.setAttribute('id', id);
    filterEl.setAttribute('x', '-100%');
    filterEl.setAttribute('y', '-100%');
    filterEl.setAttribute('width', '300%');
    filterEl.setAttribute('height', '300%');
    filterEl.setAttribute('color-interpolation-filters', 'sRGB');

    let currentInput = 'SourceGraphic';

    // 1. Process Glow Logic
    if (glow.enabled) {
      if (glow.type === 'outer') {
        const morph = document.createElementNS('http://www.w3.org/2000/svg', 'feMorphology');
        morph.setAttribute('operator', 'dilate');
        morph.setAttribute('radius', String(glow.spread));
        morph.setAttribute('in', 'SourceAlpha');
        morph.setAttribute('result', 'glow_morphed');
        filterEl.appendChild(morph);

        const flood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
        flood.setAttribute('flood-color', glow.color);
        flood.setAttribute('flood-opacity', String(glow.intensity));
        flood.setAttribute('result', 'glow_flood');
        filterEl.appendChild(flood);

        const comp = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        comp.setAttribute('in', 'glow_flood');
        comp.setAttribute('in2', 'glow_morphed');
        comp.setAttribute('operator', 'in');
        comp.setAttribute('result', 'glow_colored');
        filterEl.appendChild(comp);

        const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('stdDeviation', String(glow.blur / 2));
        blur.setAttribute('result', 'glow_out');
        filterEl.appendChild(blur);

        const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        const node1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        node1.setAttribute('in', 'glow_out');
        const node2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        node2.setAttribute('in', 'SourceGraphic');
        merge.appendChild(node1);
        merge.appendChild(node2);
        merge.setAttribute('result', 'after_glow');
        filterEl.appendChild(merge);
        currentInput = 'after_glow';
      } else {
        const flood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
        flood.setAttribute('flood-color', glow.color);
        flood.setAttribute('flood-opacity', String(glow.intensity));
        flood.setAttribute('result', 'ig_flood');
        filterEl.appendChild(flood);

        const comp1 = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        comp1.setAttribute('in', 'ig_flood');
        comp1.setAttribute('in2', 'SourceAlpha');
        comp1.setAttribute('operator', 'out');
        comp1.setAttribute('result', 'ig_inv');
        filterEl.appendChild(comp1);

        const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('stdDeviation', String(glow.blur / 2));
        blur.setAttribute('in', 'ig_inv');
        blur.setAttribute('result', 'ig_blur');
        filterEl.appendChild(blur);

        const comp2 = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        comp2.setAttribute('in', 'ig_blur');
        comp2.setAttribute('in2', 'SourceAlpha');
        comp2.setAttribute('operator', 'in');
        comp2.setAttribute('result', 'ig_colored');
        filterEl.appendChild(comp2);

        const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        const node1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        node1.setAttribute('in', 'SourceGraphic');
        const node2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        node2.setAttribute('in', 'ig_colored');
        merge.appendChild(node1);
        merge.appendChild(node2);
        merge.setAttribute('result', 'after_glow');
        filterEl.appendChild(merge);
        currentInput = 'after_glow';
      }
    }

    // 2. Process Shadow Logic
    if (shadow.enabled) {
      const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      dropShadow.setAttribute('dx', String(shadow.offsetX));
      dropShadow.setAttribute('dy', String(shadow.offsetY));
      dropShadow.setAttribute('stdDeviation', String(shadow.blur / 2));
      dropShadow.setAttribute('flood-color', shadow.color);
      dropShadow.setAttribute('flood-opacity', String(shadow.opacity));
      dropShadow.setAttribute('in', currentInput);
      filterEl.appendChild(dropShadow);
    }

    defs.appendChild(filterEl);
    setSvgContent(svg.outerHTML);
  };

  const updateElementAttribute = (attr: string, value: string | number) => {
    if (selectedElements.length === 0) return;
    selectedElements.forEach(el => {
      if (attr === 'textContent' && el.tagName === 'text') {
        el.textContent = String(value);
      } else {
        el.setAttribute(attr, String(value));
      }
    });
    setElementProps(prev => ({ ...prev, [attr === 'stroke-width' ? 'strokeWidth' : attr]: value }));
    if (canvasRef.current) {
      const svg = canvasRef.current.querySelector('svg');
      if (svg) setSvgContent(svg.outerHTML);
    }
  };

  const handleLayerAction = (action: 'front' | 'back') => {
    if (selectedElements.length === 0) return;
    selectedElements.forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      if (action === 'front') {
        parent.appendChild(el);
      } else {
        parent.insertBefore(el, parent.firstChild);
      }
    });
    if (canvasRef.current) {
      const svg = canvasRef.current.querySelector('svg');
      if (svg) setSvgContent(svg.outerHTML);
    }
  };

  const getElementVisualBBox = (el: SVGGraphicsElement) => {
    const rect = el.getBBox();
    const svg = el.ownerSVGElement;
    if (!svg) return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    
    const elCTM = el.getScreenCTM();
    const svgCTM = svg.getScreenCTM();
    if (!elCTM || !svgCTM) return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    
    const matrix = svgCTM.inverse().multiply(elCTM);
    const p = svg.createSVGPoint();
    
    const pts = [
      {x: rect.x, y: rect.y},
      {x: rect.x + rect.width, y: rect.y},
      {x: rect.x, y: rect.y + rect.height},
      {x: rect.x + rect.width, y: rect.y + rect.height}
    ].map(pt => {
      p.x = pt.x; p.y = pt.y;
      return p.matrixTransform(matrix);
    });
    
    const minX = Math.min(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxX = Math.max(...pts.map(p => p.x));
    const maxY = Math.max(...pts.map(p => p.y));
    
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElements.length === 0) return;

    const svg = canvasRef.current?.querySelector('svg');
    if (!svg) return;

    const viewBox = svg.viewBox.baseVal;
    const artboardWidth = viewBox.width || 800;
    const artboardHeight = viewBox.height || 600;

    let targetX = 0;
    let targetY = 0;
    let targetWidth = artboardWidth;
    let targetHeight = artboardHeight;

    if (selectedElements.length > 1 && bbox) {
      targetX = bbox.x;
      targetY = bbox.y;
      targetWidth = bbox.width;
      targetHeight = bbox.height;
    }

    selectedElements.forEach(el => {
      const visualBBox = getElementVisualBBox(el);
      let dx = 0;
      let dy = 0;

      if (type === 'left') dx = targetX - visualBBox.x;
      else if (type === 'center') dx = (targetX + targetWidth / 2) - (visualBBox.x + visualBBox.width / 2);
      else if (type === 'right') dx = (targetX + targetWidth) - (visualBBox.x + visualBBox.width);
      else if (type === 'top') dy = targetY - visualBBox.y;
      else if (type === 'middle') dy = (targetY + targetHeight / 2) - (visualBBox.y + visualBBox.height / 2);
      else if (type === 'bottom') dy = (targetY + targetHeight) - (visualBBox.y + visualBBox.height);

      if (dx !== 0 || dy !== 0) {
        const transformList = el.transform.baseVal;
        const translate = svg.createSVGTransform();
        translate.setTranslate(dx, dy);
        transformList.insertItemBefore(translate, 0);
        transformList.consolidate();
      }
    });

    setSvgContent(svg.outerHTML);
    // Refresh selection to trigger bbox update
    setSelectedElements([...selectedElements]);
  };

  const pickColor = async (attr: 'fill' | 'stroke') => {
    // @ts-ignore
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        updateElementAttribute(attr, result.sRGBHex);
      } catch (e) {
        console.log("Eyedropper cancelled or failed");
      }
    }
  };

  const addShape = (type: 'rect' | 'circle' | 'text') => {
    if (!canvasRef.current) return;
    const svg = canvasRef.current.querySelector('svg');
    if (!svg) return;

    const id = `shape-${Date.now()}`;
    let el: SVGElement;

    if (type === 'rect') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', '100');
      el.setAttribute('y', '100');
      el.setAttribute('width', '200');
      el.setAttribute('height', '100');
      el.setAttribute('rx', '8');
    } else if (type === 'circle') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      el.setAttribute('cx', '150');
      el.setAttribute('cy', '150');
      el.setAttribute('r', '50');
    } else {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      el.setAttribute('x', '100');
      el.setAttribute('y', '100');
      el.setAttribute('font-family', 'Inter, sans-serif');
      el.setAttribute('font-size', '24');
      el.setAttribute('font-weight', '600');
      el.textContent = 'New Text';
    }

    el.setAttribute('id', id);
    el.setAttribute('fill', '#6366f1');
    el.setAttribute('transform', 'translate(0,0)');
    svg.appendChild(el);
    setSvgContent(svg.outerHTML);
    setSelectedElements([el as SVGGraphicsElement]);
  };

  const refreshFilters = (newGlow?: typeof glowProps, newShadow?: typeof shadowProps) => {
    if (selectedElements.length === 0) return;
    const activeGlow = newGlow || glowProps;
    const activeShadow = newShadow || shadowProps;
    const filterId = `filter-${selectedElements[0].id || 'selected'}`;
    
    updateSVGFilter(filterId, activeGlow, activeShadow);
    
    selectedElements.forEach(el => {
      if (activeGlow.enabled || activeShadow.enabled) {
        el.setAttribute('filter', `url(#${filterId})`);
      } else {
        el.removeAttribute('filter');
      }
    });

    if (canvasRef.current) {
      const svg = canvasRef.current.querySelector('svg');
      if (svg) setSvgContent(svg.outerHTML);
    }
  };

  const applyShadowPreset = (p: typeof SHADOW_PRESETS[0]) => {
    const next = { ...shadowProps, ...p, enabled: true };
    setShadowProps(next);
    refreshFilters(glowProps, next);
  };

  const handleGradientUpdate = (newProps: typeof gradientProps) => {
    if (selectedElements.length === 0) return;
    setGradientProps(newProps);
    const gradId = `grad-${selectedElements[0].id || 'selected'}`;
    updateSVGDefs(gradId, newProps.type, newProps.stops, newProps.angle);
    selectedElements.forEach(el => el.setAttribute('fill', `url(#${gradId})`));
    if (canvasRef.current) {
      const svg = canvasRef.current.querySelector('svg');
      if (svg) setSvgContent(svg.outerHTML);
    }
  };

  const applyPreset = (preset: typeof GRADIENT_PRESETS[0]) => {
    setFillType('gradient');
    const nextProps = {
      type: preset.type as 'linear' | 'radial',
      angle: preset.angle,
      stops: preset.stops.map((s, i) => ({ id: String(i), ...s }))
    };
    handleGradientUpdate(nextProps);
  };

  // Fixed: explicitly typing 'file' as File to avoid 'unknown' property access errors
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray: AttachedFile[] = [];
    const promises = Array.from(files).map((file: File) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          fileArray.push({
            name: file.name,
            type: file.type,
            base64: event.target?.result as string
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(() => {
      setAttachedFiles(prev => [...prev, ...fileArray]);
    });
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSystemError(null);
    setSelectedElements([]);
    setLoadingMessage('Strategizing Layout...');
    try {
      const db = await generateDesignBrief(attachedFiles, [], manualPrompt, selectedPreset, selectedModel);
      db.pageSize = pageSize;
      setBrief(db);
      setLoadingMessage('Forging Premium Vectors...');
      const svg = await generateSVGDesign(db, manualPrompt, selectedModel);
      setSvgContent(svg);
      setActiveTab('canvas');
    } catch (err: any) {
      if (err.message === "ENTITY_NOT_FOUND") {
        setIsApiKeySelected(false);
        handleSelectKey();
      } else {
        setSystemError(err.message || "Generation failed.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectGenerate = async () => {
    if (!manualPrompt) return;
    setIsGenerating(true);
    setSystemError(null);
    setLoadingMessage('Direct Forging...');
    try {
      const svg = await generateSVGDirectly(manualPrompt, selectedModel);
      setSvgContent(svg);
      setActiveTab('canvas');
    } catch (err: any) {
      setSystemError(err.message || "Direct generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!svgContent || !manualPrompt) return;
    setIsGenerating(true);
    setSystemError(null);
    setLoadingMessage('Refining Design...');
    try {
      const refined = await refineSVGDesign(svgContent, manualPrompt, selectedModel);
      setSvgContent(refined);
    } catch (err: any) {
      setSystemError(err.message || "Refinement failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDiscoverTrend = async () => {
    setIsTrending(true);
    setLoadingMessage('Scouting Global Trends...');
    try {
      const trend = await discoverTrendingIdea();
      setManualPrompt(trend.concept);
      setSelectedPreset(trend.recommendedPreset);
    } catch (err) {
      setSystemError("Trend discovery timed out. Please try again.");
    } finally {
      setIsTrending(false);
    }
  };

  const handleCopySvg = async () => {
    if (!svgContent) return;
    await navigator.clipboard.writeText(svgContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportPro = (format: 'svg' | 'ai') => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: format === 'svg' ? 'image/svg+xml' : 'application/postscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vector_visions_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const gradientPreviewStyle = {
    background: `${gradientProps.type}-gradient(${gradientProps.type === 'linear' ? `${gradientProps.angle}deg, ` : ''}${gradientProps.stops.map(s => `${s.color} ${s.offset}%`).join(', ')})`
  };

  return (
    <div className="flex h-screen w-full bg-[#0b0f19] text-slate-200 overflow-hidden font-sans">
      <aside className="w-80 border-r border-slate-800 flex flex-col glass z-20 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">V</div>
            <h1 className="font-bold text-lg tracking-tight">Visions Studio</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <section className="p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/30 shadow-xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <h3 className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">AI Trend Scout</h3>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">Discover 2025 high-end design trends.</p>
              <Button 
                variant="primary" 
                size="sm" 
                className="w-full py-2.5 bg-indigo-600/50 hover:bg-indigo-600 border border-indigo-500/30 font-bold uppercase text-[9px] tracking-tighter"
                isLoading={isTrending}
                onClick={handleDiscoverTrend}
              >
                Auto Discover Trend
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Visual Reference</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center hover:border-indigo-500 transition-all cursor-pointer bg-slate-900/50 group"
            >
              <svg className="w-8 h-8 text-slate-600 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attach Inspiration</span>
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
            </div>
            
            {attachedFiles.length > 0 && (
              <div className="grid grid-cols-4 gap-2 animate-in fade-in duration-300">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-800">
                    <img src={file.base64} className="w-full h-full object-cover" alt="ref" />
                    <button 
                      onClick={() => removeAttachedFile(idx)}
                      className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Style Preset</label>
            <div className="grid grid-cols-1 gap-2">
              {COMPONENT_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPreset(p)}
                  className={`text-left px-4 py-2.5 rounded-xl text-[11px] font-semibold border transition-all ${selectedPreset === p ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-inner' : 'bg-slate-900/30 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Design Prompt</label>
            <textarea
              className="w-full h-24 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-100 focus:ring-2 focus:ring-indigo-500/30 outline-none resize-none transition-all"
              placeholder="Describe your vision or modification..."
              value={manualPrompt}
              onChange={(e) => setManualPrompt(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button 
                  className="flex-1 py-4 font-bold bg-indigo-600 hover:bg-indigo-500 uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-500/20" 
                  isLoading={isGenerating && loadingMessage === 'Forging Premium Vectors...'} 
                  onClick={handleGenerate}
                >
                  Forge New
                </Button>
                <Button 
                  className="flex-1 py-4 font-bold bg-emerald-600 hover:bg-emerald-500 uppercase text-[10px] tracking-widest shadow-2xl shadow-emerald-500/20" 
                  isLoading={isGenerating && loadingMessage === 'Direct Forging...'} 
                  onClick={handleDirectGenerate}
                  disabled={!manualPrompt}
                >
                  Direct Forge
                </Button>
              </div>
              {svgContent && (
                <Button 
                  variant="secondary"
                  className="w-full py-4 font-bold border-slate-700 uppercase text-[10px] tracking-widest" 
                  isLoading={isGenerating && loadingMessage === 'Refining Design...'} 
                  onClick={handleRefine}
                  disabled={!manualPrompt}
                >
                  Refine Current
                </Button>
              )}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[#0b0f19]">
        <header className="h-16 border-b border-slate-900 glass flex items-center justify-between px-8 z-10">
          <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${activeTab === 'canvas' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setActiveTab('canvas')}>Canvas</button>
            <button className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${activeTab === 'code' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setActiveTab('code')}>Source</button>
          </div>

          <div className="flex gap-3 relative">
            <Button variant="ghost" size="sm" onClick={handleCopySvg} disabled={!svgContent} className="px-5 font-bold uppercase text-[10px] border border-slate-700">
              {isCopied ? 'Copied!' : 'Copy SVG'}
            </Button>
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowExportMenu(!showExportMenu)} disabled={!svgContent} className="px-5 font-bold uppercase text-[10px] border-slate-700">
                Export
              </Button>
              {showExportMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-1 overflow-hidden">
                  <button onClick={() => handleExportPro('svg')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download SVG
                  </button>
                  <button onClick={() => handleExportPro('ai')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    Download AI (PS)
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div 
          className="flex-1 relative overflow-auto p-12 canvas-bg custom-scrollbar" 
          ref={canvasRef} 
          onClick={() => setShowExportMenu(false)}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* Toolbar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-2xl backdrop-blur-md z-20">
            <button onClick={() => addShape('rect')} className="p-2.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Rectangle">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" /></svg>
            </button>
            <button onClick={() => addShape('circle')} className="p-2.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Circle">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" strokeWidth="2" /></svg>
            </button>
            <button onClick={() => addShape('text')} className="p-2.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Text">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
            </button>
            <div className="w-px bg-slate-800 mx-1 my-2" />
            <button onClick={() => handleLayerAction('front')} className="p-2.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Bring to Front" disabled={selectedElements.length === 0}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={() => handleLayerAction('back')} className="p-2.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Send to Back" disabled={selectedElements.length === 0}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>

          {activeTab === 'canvas' ? (
            <div className="flex items-center justify-center min-h-full">
              {svgContent ? (
                <div 
                  onMouseDown={handleCanvasMouseDown} 
                  className={`shadow-2xl bg-white rounded-lg relative ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`} 
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: svgContent }} className="pointer-events-auto [&_*]:cursor-pointer" />
                  {bbox && (
                    <div className="absolute pointer-events-none border-2 border-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]" style={{ left: bbox.x - 2, top: bbox.y - 2, width: bbox.width + 4, height: bbox.height + 4 }}>
                      {/* Resize Handles */}
                      <div data-handle="nw" className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full pointer-events-auto cursor-nwse-resize" />
                      <div data-handle="ne" className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full pointer-events-auto cursor-nesw-resize" />
                      <div data-handle="sw" className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full pointer-events-auto cursor-nesw-resize" />
                      <div data-handle="se" className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full pointer-events-auto cursor-nwse-resize" />
                      
                      {/* Rotation Handle */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0 pointer-events-none">
                        <div data-handle="rotate" className="w-4 h-4 bg-white border-2 border-indigo-500 rounded-full pointer-events-auto cursor-alias shadow-lg hover:bg-indigo-50 transition-colors" />
                        <div className="w-0.5 h-4 bg-indigo-500" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 opacity-20 text-center">
                  <svg className="w-16 h-16 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <p className="font-bold text-sm uppercase tracking-[0.4em]">Empty Canvas</p>
                </div>
              )}
            </div>
          ) : (
            <textarea className="w-full h-full bg-[#0b0f19] p-8 font-mono text-[11px] text-indigo-300 outline-none border-0 custom-scrollbar" value={svgContent} readOnly />
          )}
        </div>
        
        <div className="absolute bottom-6 right-6 flex bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-2xl backdrop-blur-md">
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 font-bold">-</button>
          <div className="px-3 flex items-center text-[10px] font-bold w-12 justify-center text-slate-200">{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 font-bold">+</button>
        </div>
      </main>

      <aside className="w-80 border-l border-slate-800 glass hidden lg:flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inspector</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {selectedElements.length > 0 ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Global FX</h3>
                <span className="text-[9px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-bold uppercase">{selectedElements.length} Selected</span>
              </div>

              <div className="p-4 bg-slate-500/5 rounded-2xl border border-slate-500/10 space-y-4">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block">Alignment</label>
                <div className="grid grid-cols-6 gap-2">
                  <button onClick={() => handleAlign('left')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center" title="Align Left">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v16M8 8h12M8 16h8" /></svg>
                  </button>
                  <button onClick={() => handleAlign('center')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center" title="Align Center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16M8 8h8M6 16h12" /></svg>
                  </button>
                  <button onClick={() => handleAlign('right')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center" title="Align Right">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 4v16M4 8h12M8 16h12" /></svg>
                  </button>
                  <button onClick={() => handleAlign('top')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center" title="Align Top">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16M8 8v12M16 8v8" /></svg>
                  </button>
                  <button onClick={() => handleAlign('middle')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center" title="Align Middle">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16M8 8v8M16 6v12" /></svg>
                  </button>
                  <button onClick={() => handleAlign('bottom')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center" title="Align Bottom">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 20h16M8 4v12M16 8v12" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-500/5 rounded-2xl border border-slate-500/10 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Layer Order</label>
                  <div className="flex gap-2">
                    <button onClick={() => handleLayerAction('front')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleLayerAction('back')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              {selectedElements.length === 1 && selectedElements[0].tagName === 'text' && (
                <div className="p-4 bg-slate-500/5 rounded-2xl border border-slate-500/10 space-y-3">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Text Content</label>
                  <textarea 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[11px] text-slate-300 outline-none focus:border-indigo-500 resize-none h-20"
                    value={elementProps.textContent}
                    onChange={(e) => updateElementAttribute('textContent', e.target.value)}
                  />
                </div>
              )}

              <div className="p-4 bg-slate-500/5 rounded-2xl border border-slate-500/10 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Advanced Shadow</label>
                  <button 
                    onClick={() => { const next = { ...shadowProps, enabled: !shadowProps.enabled }; setShadowProps(next); refreshFilters(glowProps, next); }}
                    className={`w-8 h-4 rounded-full transition-all relative ${shadowProps.enabled ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${shadowProps.enabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {shadowProps.enabled && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-2 border-t border-slate-800 pt-3">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Shadow Presets</label>
                      <div className="grid grid-cols-5 gap-2 mb-4">
                        {SHADOW_PRESETS.map((p) => (
                          <button 
                            key={p.name}
                            onClick={() => applyShadowPreset(p)}
                            title={p.name}
                            className="w-full aspect-square rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500 transition-all flex items-center justify-center group"
                          >
                            <div 
                              className="w-4 h-4 bg-slate-400 rounded-sm" 
                              style={{ boxShadow: `${p.offsetX/4}px ${p.offsetY/4}px ${p.blur/4}px ${p.color}${Math.round(p.opacity * 255).toString(16).padStart(2, '0')}` }}
                            />
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={shadowProps.color}
                          onChange={(e) => { const next = { ...shadowProps, color: e.target.value }; setShadowProps(next); refreshFilters(glowProps, next); }}
                          className="w-8 h-8 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase">
                            <span>Opacity</span>
                            <span>{Math.round(shadowProps.opacity * 100)}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="1" step="0.05"
                            value={shadowProps.opacity}
                            onChange={(e) => { const next = { ...shadowProps, opacity: parseFloat(e.target.value) }; setShadowProps(next); refreshFilters(glowProps, next); }}
                            className="w-full h-1 accent-indigo-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase">
                          <span>Offset X</span>
                          <span>{shadowProps.offsetX}px</span>
                        </div>
                        <input 
                          type="range" min="-100" max="100" step="1"
                          value={shadowProps.offsetX}
                          onChange={(e) => { const next = { ...shadowProps, offsetX: parseInt(e.target.value) }; setShadowProps(next); refreshFilters(glowProps, next); }}
                          className="w-full h-1 accent-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase">
                          <span>Offset Y</span>
                          <span>{shadowProps.offsetY}px</span>
                        </div>
                        <input 
                          type="range" min="-100" max="100" step="1"
                          value={shadowProps.offsetY}
                          onChange={(e) => { const next = { ...shadowProps, offsetY: parseInt(e.target.value) }; setShadowProps(next); refreshFilters(glowProps, next); }}
                          className="w-full h-1 accent-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-mono text-slate-400 uppercase">
                        <span>Blur Radius</span>
                        <span>{shadowProps.blur}px</span>
                      </div>
                      <input 
                        type="range" min="0" max="200" step="1"
                        value={shadowProps.blur}
                        onChange={(e) => { const next = { ...shadowProps, blur: parseInt(e.target.value) }; setShadowProps(next); refreshFilters(glowProps, next); }}
                        className="w-full h-1 accent-indigo-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bloom & Glow</label>
                  <button 
                    onClick={() => { const next = { ...glowProps, enabled: !glowProps.enabled }; setGlowProps(next); refreshFilters(next, shadowProps); }}
                    className={`w-8 h-4 rounded-full transition-all relative ${glowProps.enabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${glowProps.enabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {glowProps.enabled && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <input 
                          type="color" 
                          value={glowProps.color}
                          onChange={(e) => { const next = { ...glowProps, color: e.target.value }; setGlowProps(next); refreshFilters(next, shadowProps); }}
                          className="w-8 h-8 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden"
                        />
                        <div className="flex-1 flex bg-slate-900/50 rounded-lg p-1 border border-slate-800">
                          <button 
                            onClick={() => { const next = { ...glowProps, type: 'outer' as const }; setGlowProps(next); refreshFilters(next, shadowProps); }}
                            className={`flex-1 py-1 text-[9px] font-bold uppercase rounded transition-all ${glowProps.type === 'outer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                          >Outer</button>
                          <button 
                            onClick={() => { const next = { ...glowProps, type: 'inner' as const }; setGlowProps(next); refreshFilters(next, shadowProps); }}
                            className={`flex-1 py-1 text-[9px] font-bold uppercase rounded transition-all ${glowProps.type === 'inner' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                          >Inner</button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-slate-400 uppercase">
                          <span>Intensity</span>
                          <span>{Math.round(glowProps.intensity * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.01"
                          value={glowProps.intensity}
                          onChange={(e) => { const next = { ...glowProps, intensity: parseFloat(e.target.value) }; setGlowProps(next); refreshFilters(next, shadowProps); }}
                          className="w-full h-1 accent-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-slate-400 uppercase">
                          <span>Spread</span>
                          <span>{glowProps.spread}px</span>
                        </div>
                        <input 
                          type="range" min="0" max="50" step="1"
                          value={glowProps.spread}
                          onChange={(e) => { const next = { ...glowProps, spread: parseInt(e.target.value) }; setGlowProps(next); refreshFilters(next, shadowProps); }}
                          className="w-full h-1 accent-indigo-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fill Section */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fill</label>
                  <div className="flex bg-slate-900/50 rounded-lg p-0.5 border border-slate-800">
                    <button 
                      onClick={() => setFillType('solid')}
                      className={`px-2 py-1 text-[8px] font-bold uppercase rounded transition-all ${fillType === 'solid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >Solid</button>
                    <button 
                      onClick={() => setFillType('gradient')}
                      className={`px-2 py-1 text-[8px] font-bold uppercase rounded transition-all ${fillType === 'gradient' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >Grad</button>
                  </div>
                </div>

                {fillType === 'solid' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                      <div className="relative group">
                        <input 
                          type="color" 
                          value={elementProps.fill === 'none' || elementProps.fill.startsWith('url') ? '#000000' : elementProps.fill}
                          onChange={(e) => updateElementAttribute('fill', e.target.value)}
                          className="w-10 h-10 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden"
                        />
                        {elementProps.fill === 'none' && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-full h-0.5 bg-red-500 rotate-45" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <input 
                            type="text" 
                            value={elementProps.fill}
                            onChange={(e) => updateElementAttribute('fill', e.target.value)}
                            className="bg-transparent border-none text-[11px] font-mono text-slate-300 outline-none uppercase w-20"
                            placeholder="#000000"
                          />
                          <div className="flex gap-1.5">
                            {/* @ts-ignore */}
                            {typeof window !== 'undefined' && 'EyeDropper' in window && (
                              <button onClick={() => pickColor('fill')} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors" title="Eyedropper">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21l-4-4m0 0L5.5 14.5m-2.5 2.5l6-6M17 7l3 3m-3-3l-3-3m3 3l-6 6m6-6l-3 3" /></svg>
                              </button>
                            )}
                            <button onClick={() => updateElementAttribute('fill', 'none')} className="text-[8px] text-slate-500 hover:text-red-400 uppercase font-bold">None</button>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => updateElementAttribute('fill', '#ffffff')} className="w-3 h-3 rounded-full bg-white border border-slate-700 hover:scale-125 transition-transform" />
                          <button onClick={() => updateElementAttribute('fill', '#000000')} className="w-3 h-3 rounded-full bg-black border border-slate-700 hover:scale-125 transition-transform" />
                          <button onClick={() => updateElementAttribute('fill', '#6366f1')} className="w-3 h-3 rounded-full bg-indigo-500 border border-slate-700 hover:scale-125 transition-transform" />
                          <button onClick={() => updateElementAttribute('fill', '#10b981')} className="w-3 h-3 rounded-full bg-emerald-500 border border-slate-700 hover:scale-125 transition-transform" />
                          <button onClick={() => updateElementAttribute('fill', '#f59e0b')} className="w-3 h-3 rounded-full bg-amber-500 border border-slate-700 hover:scale-125 transition-transform" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Quick Gradients</label>
                      <div className="grid grid-cols-5 gap-2">
                        {GRADIENT_PRESETS.map((p) => (
                          <button 
                            key={p.name}
                            onClick={() => applyPreset(p)}
                            title={p.name}
                            className="w-full aspect-square rounded-full border border-slate-700 hover:scale-110 transition-transform shadow-lg"
                            style={{ background: `${p.type}-gradient(${p.type === 'linear' ? `${p.angle}deg, ` : ''}${p.stops.map(s => `${s.color} ${s.offset}%`).join(', ')})` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Gradient Library</label>
                      <div className="grid grid-cols-5 gap-2">
                        {GRADIENT_PRESETS.map((p) => (
                          <button 
                            key={p.name}
                            onClick={() => applyPreset(p)}
                            title={p.name}
                            className="w-full aspect-square rounded-full border border-slate-700 hover:scale-110 transition-transform shadow-lg"
                            style={{ background: `${p.type}-gradient(${p.type === 'linear' ? `${p.angle}deg, ` : ''}${p.stops.map(s => `${s.color} ${s.offset}%`).join(', ')})` }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Type</label>
                        <div className="flex bg-slate-900/50 rounded-lg p-0.5 border border-slate-800">
                          <button 
                            onClick={() => handleGradientUpdate({ ...gradientProps, type: 'linear' })}
                            className={`px-2 py-1 text-[8px] font-bold uppercase rounded transition-all ${gradientProps.type === 'linear' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          >Linear</button>
                          <button 
                            onClick={() => handleGradientUpdate({ ...gradientProps, type: 'radial' })}
                            className={`px-2 py-1 text-[8px] font-bold uppercase rounded transition-all ${gradientProps.type === 'radial' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          >Radial</button>
                        </div>
                      </div>

                      {gradientProps.type === 'linear' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] font-mono text-slate-400 uppercase">
                            <span>Angle</span>
                            <span>{gradientProps.angle}°</span>
                          </div>
                          <input 
                            type="range" min="0" max="360" step="1"
                            value={gradientProps.angle}
                            onChange={(e) => handleGradientUpdate({ ...gradientProps, angle: parseInt(e.target.value) })}
                            className="w-full h-1 accent-indigo-400"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Stops</label>
                          <div className="flex gap-1.5">
                            {gradientProps.stops.map((stop, idx) => (
                              <div key={stop.id} className="flex flex-col items-center gap-1">
                                <input 
                                  type="color" 
                                  value={stop.color}
                                  onChange={(e) => {
                                    const nextStops = [...gradientProps.stops];
                                    nextStops[idx] = { ...stop, color: e.target.value };
                                    handleGradientUpdate({ ...gradientProps, stops: nextStops });
                                  }}
                                  className="w-5 h-5 bg-transparent border-none cursor-pointer rounded overflow-hidden"
                                />
                                <span className="text-[7px] font-mono text-slate-500">{stop.offset}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stroke & Opacity Section */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stroke & Style</label>
                <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                  <div className="relative">
                    <input 
                      type="color" 
                      value={elementProps.stroke === 'none' ? '#000000' : elementProps.stroke}
                      onChange={(e) => updateElementAttribute('stroke', e.target.value)}
                      className="w-10 h-10 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden"
                    />
                    {elementProps.stroke === 'none' && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-500 rotate-45" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <input 
                        type="text" 
                        value={elementProps.stroke}
                        onChange={(e) => updateElementAttribute('stroke', e.target.value)}
                        className="bg-transparent border-none text-[11px] font-mono text-slate-300 outline-none uppercase w-20"
                        placeholder="none"
                      />
                      <div className="flex gap-1.5">
                        {/* @ts-ignore */}
                        {typeof window !== 'undefined' && 'EyeDropper' in window && (
                          <button onClick={() => pickColor('stroke')} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors" title="Eyedropper">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21l-4-4m0 0L5.5 14.5m-2.5 2.5l6-6M17 7l3 3m-3-3l-3-3m3 3l-6 6m6-6l-3 3" /></svg>
                          </button>
                        )}
                        <button onClick={() => updateElementAttribute('stroke', 'none')} className="text-[8px] text-slate-500 hover:text-red-400 uppercase font-bold">None</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] font-mono text-slate-500 uppercase">Width</span>
                       <input 
                        type="range" min="0" max="40" step="1"
                        value={elementProps.strokeWidth}
                        onChange={(e) => updateElementAttribute('stroke-width', parseInt(e.target.value))}
                        className="flex-1 h-1 accent-indigo-400"
                      />
                      <span className="text-[9px] font-mono text-slate-400 w-6 text-right">{elementProps.strokeWidth}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Opacity</span>
                    <span className="font-mono text-indigo-400">{Math.round(elementProps.opacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={elementProps.opacity}
                    onChange={(e) => updateElementAttribute('opacity', parseFloat(e.target.value))}
                    className="w-full h-1 accent-indigo-400"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 space-y-3">
                <Button variant="danger" size="sm" className="w-full font-bold uppercase text-[10px] py-3 tracking-widest" onClick={() => { selectedElements.forEach(el => el.remove()); setSelectedElements([]); if (canvasRef.current) setSvgContent(canvasRef.current.querySelector('svg')?.outerHTML || ''); }}>
                  Delete Selected
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full opacity-20 text-center gap-6">
              <div className="w-20 h-20 border-2 border-dashed border-slate-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed">Select a layer<br/>to adjust properties</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}