// This function defines a Fire module.
// - `ctx` - A canvas context for drawing
// - `x` - The initial x position of the fire
// - `y` - The initial y position of the fire
const Fire = function(ctx, x, y) {
    // Use the sprite module for animation
    const sprite = Sprite(ctx, x, y)
        .useSheet("object_sprites.png") // Make sure this file is in the correct path
        .setSequence({
            x: 0,       // Starting x position of the first fire sprite (bottom left)
            y: 160,     // Starting y position of the fire sprites (bottom row, adjust based on the image)
            width: 16,  // Width of each fire sprite
            height: 16, // Height of each fire sprite
            count: 8,   // Total number of frames in the fire animation
            timing: 100, // Timing for frame changes in milliseconds
            loop: true  // Enable looping for continuous animation
        })
        .setScale(1.5); // Scale the fire sprite to make it more visible

    // This function updates the fire animation
    const update = function(time) {
        sprite.update(time);
        return this;
    };

    // This function draws the fire
    const draw = function() {
        sprite.draw();
        return this;
    };

    // Return the public functions
    return {
        update: update,
        draw: draw
    };
};
