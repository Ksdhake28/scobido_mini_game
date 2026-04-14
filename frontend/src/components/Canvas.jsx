import React, { useRef, useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const Canvas = ({ drawerId }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const socket = useSocket();

  const [color, setColor] = useState('black');
  const [brushSize, setBrushSize] = useState(5);

  const colors = ['black', 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'brown', 'white'];

  const isMyTurn = socket?.id === drawerId;

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800; // Fixed canvas size for sync
    canvas.height = 600;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    contextRef.current = context;
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize]);

  useEffect(() => {
    if (!socket) return;

    const handleDrawStroke = ({ offsetX, offsetY, isStarting, color, size }) => {
       const ctx = contextRef.current;
       ctx.strokeStyle = color;
       ctx.lineWidth = size;

       if (isStarting) {
          ctx.beginPath();
          ctx.moveTo(offsetX, offsetY);
       } else {
          ctx.lineTo(offsetX, offsetY);
          ctx.stroke();
       }
    };

    const handleClearCanvas = () => {
       const ctx = contextRef.current;
       ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    socket.on('draw_stroke', handleDrawStroke);
    socket.on('clear_canvas', handleClearCanvas);

    return () => {
      socket.off('draw_stroke');
      socket.off('clear_canvas');
    };
  }, [socket]);

  const startDrawing = ({ nativeEvent }) => {
    if (!isMyTurn) return;
    const { offsetX, offsetY } = nativeEvent;
    
    contextRef.current.strokeStyle = color;
    contextRef.current.lineWidth = brushSize;
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);

    socket.emit('draw', { offsetX, offsetY, isStarting: true, color, size: brushSize });
  };

  const finishDrawing = () => {
    if (!isMyTurn) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing || !isMyTurn) return;
    const { offsetX, offsetY } = nativeEvent;
    
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();

    socket.emit('draw', { offsetX, offsetY, isStarting: false, color, size: brushSize });
  };

  const handleClear = () => {
    if(!isMyTurn) return;
    socket.emit('clear_canvas');
  };

  return (
    <div className="canvas-container">
      <div className="toolbar" style={{ display: isMyTurn ? 'flex' : 'none' }}>
         <div className="colors">
           {colors.map(c => (
              <div 
                key={c}
                className={`color-swatch ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
           ))}
         </div>
         <input 
           type="range" 
           min="1" 
           max="20" 
           value={brushSize} 
           onChange={(e) => setBrushSize(parseInt(e.target.value))} 
         />
         <button onClick={handleClear} className="clear-btn">Clear</button>
      </div>
      <canvas
        className={`drawing-canvas ${isMyTurn ? 'my-turn' : ''}`}
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseOut={finishDrawing}
        onMouseMove={draw}
        ref={canvasRef}
      />
    </div>
  );
};

export default Canvas;
