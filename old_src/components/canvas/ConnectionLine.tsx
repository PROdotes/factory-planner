
import React from 'react';
import { ConnectionLineComponentProps } from 'reactflow';

const ConnectionLine: React.FC<ConnectionLineComponentProps> = ({
    fromX,
    fromY,
    toX,
    toY,
}) => {
    const midX = fromX + (toX - fromX) * 0.5;

    return (
        <g>
            <path
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                className="animated"
                d={`M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX},${toY}`}
            />
            <circle
                cx={toX}
                cy={toY}
                fill="#fff"
                r={3}
                stroke="#3b82f6"
                strokeWidth={1.5}
            />
        </g>
    );
};

export default ConnectionLine;
