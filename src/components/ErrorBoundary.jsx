import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service here
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-red-50 p-8 rounded-2xl border border-red-200 text-center m-4">
                    <AlertTriangle size={48} className="text-red-500 mb-4" />
                    <h2 className="text-xl font-black text-red-700 mb-2">Oups! Une erreur est survenue.</h2>
                    <p className="text-sm font-medium text-red-600 mb-6 max-w-md">
                        {this.state.error?.toString()}
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold shadow-md hover:bg-red-700 transition-colors"
                    >
                        Recharger la page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}