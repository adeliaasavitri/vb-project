// This function defines a Sprite module.
// - `ctx` - A canvas context for drawing
// - `x` - The initial x position of the sprite
// - `y` - The initial y position of the sprite
const Sprite = function(ctx, x, y) {

    // This is the image object for the sprite sheet.
    const sheet = new Image();

    // This is an object containing the sprite sequence information used by the sprite
    let sequence = { x: 0, y: 0, width: 20, height: 20, count: 1, timing: 0, loop: false };

    // This is the index indicating the current sprite image used in the sprite sequence.
    let index = 0;

    // This is the scaling factor for drawing the sprite.
    let scale = 1;

    // This is the scaling factor to determine the size of the shadow, relative to the scaled sprite image size.
    let shadowScale = { x: 1, y: 0.25 };

    // This is the updated time of the current sprite image.
    let lastUpdate = 0;

    // This function uses a new sprite sheet in the image object.
    const useSheet = function(spriteSheet) {
        sheet.src = spriteSheet;
        return this;
    };

    // This function returns the readiness of the sprite sheet image.
    const isReady = function() {
        return sheet.complete && sheet.naturalHeight !== 0;
    };

    // This function gets the current sprite position.
    const getXY = function() {
        return { x, y };
    };

    // This function sets the sprite position.
    const setXY = function(xvalue, yvalue) {
        [x, y] = [xvalue, yvalue];
        return this;
    };

    // This function sets the sprite sequence.
    const setSequence = function(newSequence) {
        sequence = newSequence;
        index = 0;
        lastUpdate = 0;
        return this;
    };

    // This function sets the scaling factor of the sprite.
    const setScale = function(value) {
        scale = value;
        return this;
    };

    // This function sets the scaling factor of the sprite shadow.
    const setShadowScale = function(value) {
        shadowScale = value;
        return this;
    };

    // This function gets the display size of the sprite.
    const getDisplaySize = function() {
        const scaledWidth = sequence.width * scale;
        const scaledHeight = sequence.height * scale;
        return { width: scaledWidth, height: scaledHeight };
    };

    // This function gets the bounding box of the sprite.
    const getBoundingBox = function() {
        const size = getDisplaySize();
        const top = y - size.height / 2;
        const left = x - size.width / 2;
        const bottom = y + size.height / 2;
        const right = x + size.width / 2;
        return BoundingBox(ctx, top, left, bottom, right);
    };

    // This function draws the shadow underneath the sprite.
    const drawShadow = function() {
        ctx.save();
        const size = getDisplaySize();
        const shadowWidth = size.width * shadowScale.x;
        const shadowHeight = size.height * shadowScale.y;

        ctx.fillStyle = "black";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(x, y + size.height / 2,
                    shadowWidth / 2, shadowHeight / 2, 0, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
    };

    // This function draws the sprite.
    const drawSprite = function() {
        ctx.save();
        const size = getDisplaySize();

        // Draw the sprite from the sprite sheet
        ctx.drawImage(
            sheet,
            sequence.x + index * sequence.width,
            sequence.y,
            sequence.width,
            sequence.height,
            x - size.width / 2,
            y - size.height / 2,
            size.width,
            size.height
        );

        ctx.restore();
    };

    // This function draws the shadow and the sprite.
    const draw = function() {
        if (isReady()) {
            drawShadow();
            drawSprite();
        }
        return this;
    };

    // This function updates the sprite by moving to the next sprite at the appropriate time.
    const update = function(time) {
        if (lastUpdate === 0) lastUpdate = time;

        if (time - lastUpdate >= sequence.timing){
            index++;
            if(index >= sequence.count){
                if (sequence.loop){
                    index = 0;
                } else{
                    index--;
                }

                
            }
            lastUpdate = time;


        }

        

        return this;
    };

    // The methods are returned as an object here.
    return {
        useSheet: useSheet,
        getXY: getXY,
        setXY: setXY,
        setSequence: setSequence,
        setScale: setScale,
        setShadowScale: setShadowScale,
        getDisplaySize: getDisplaySize,
        getBoundingBox: getBoundingBox,
        isReady: isReady,
        draw: draw,
        update: update
    };
};
