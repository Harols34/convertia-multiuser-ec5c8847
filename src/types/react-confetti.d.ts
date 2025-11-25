declare module 'react-confetti' {
    import React from 'react';

    export interface ConfettiProps {
        width?: number;
        height?: number;
        numberOfPieces?: number;
        friction?: number;
        wind?: number;
        gravity?: number;
        initialVelocityX?: number;
        initialVelocityY?: number;
        colors?: string[];
        opacity?: number;
        recycle?: boolean;
        run?: boolean;
        onConfettiComplete?: (confetti: any) => void;
    }

    export default class Confetti extends React.Component<ConfettiProps, any> { }
}
