import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface NgrokImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
}

/**
 * A specialized image component that bypasses the Ngrok "Browser Warning" page
 * by fetching the image with the 'ngrok-skip-browser-warning' header.
 */
export function NgrokImage({ src, alt, className, style, ...props }: NgrokImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!src) return;

        setLoading(true);
        setError(false);

        // Standard Ngrok bypass via query parameter is MORE reliable than headers 
        // because it doesn't trigger CORS preflight (OPTIONS) requests.
        const bypassUrl = src.includes('?') 
            ? `${src}&ngrok-skip-browser-warning=1` 
            : `${src}?ngrok-skip-browser-warning=1`;
            
        setImageUrl(bypassUrl);
        setLoading(false);
    }, [src]);

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-slate-800/50 text-slate-500 text-[10px] ${className}`} style={style}>
                FAILED TO LOAD
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-slate-800/30 ${className}`} style={style}>
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            </div>
        );
    }

    return (
        <img 
            src={imageUrl || ''} 
            alt={alt} 
            className={className} 
            style={style} 
            {...props} 
        />
    );
}
