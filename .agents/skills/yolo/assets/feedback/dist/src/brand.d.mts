export declare function renderMark({ decorative }?: {
    decorative?: boolean | undefined;
}): string;
export declare const idleCss: string;
export declare const animatedSvg: string;
/**
 * @param {SVGSVGElement | HTMLImageElement} mark
 * @param {{trigger?: Element, onActivate?: () => void}} [options]
 */
export declare function animateYoloMark(mark: SVGSVGElement | HTMLImageElement, { trigger, onActivate }?: {
    trigger?: Element;
    onActivate?: () => void;
}): {
    play: () => void;
    press: () => void;
    release: () => void;
    destroy(): void;
};
