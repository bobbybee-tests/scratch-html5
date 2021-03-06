// Copyright (C) 2013 Massachusetts Institute of Technology
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 2,
// as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

// Scratch HTML5 Player
// Sprite.js
// Tim Mickel, July 2011 - March 2012

// The Sprite provides the interface and implementation for Scratch sprite-control

'use strict';

var Sprite = function(data) {
    if(!this.data) {
        this.data = data;
    }

    // Public variables used for Scratch-accessible data.
    this.visible = (typeof(this.data.visible) == "undefined") ? true : data.visible;

    this.scratchX = data.scratchX || 0;
    this.scratchY = data.scratchY || 0;

    this.scale = data.scale || 1.0;

    this.direction = data.direction || 90;
    this.rotation = (data.direction - 90) || 0;
    this.rotationStyle = data.rotationStyle || 'normal';
    this.isFlipped = data.direction < 0 && data.rotationStyle == 'leftRight';
    this.costumes = data.costumes || [];
    this.currentCostumeIndex = data.currentCostumeIndex || 0;
    this.previousCostumeIndex = -1;

    this.objName = data.objName || '';

    this.variables = {};
    if (data.variables) {
        for (var i = 0; i < data.variables.length; i++) {
            this.variables[data.variables[i]['name']] = data.variables[i]['value'];
        }
    }
    this.lists = {};
    if (data.lists) {
        for (var i = 0; i < data.lists.length; i++) {
            this.lists[data.lists[i]['listName']] = data.lists[i];
        }
    }

    // Used for the pen
    this.penIsDown = false;
    this.penWidth = 1;
    this.penHue = 120; // blue
    this.penShade = 50; // full brightness and saturation
    this.penColorCache = 0x0000FF;

    // Used for layering
    if (!this.z) this.z = io.getCount();

    // HTML element for the talk bubbles
    this.talkBubble = null;
    this.talkBubbleBox = null;
    this.talkBubbleStyler = null;
    this.talkBubbleOn = false;

    // Internal variables used for rendering meshes.
    this.textures = [];
    this.materials = [];
    this.geometries = [];
    this.mesh = null;

    // Sound buffers and data
    this.sounds = {};
    if (data.sounds) {
        for (var i = 0; i < data.sounds.length; i++) {
            this.sounds[data.sounds[i]['soundName']] = data.sounds[i];
        }
    }
    this.soundsLoaded = 0;
    this.instrument = 1;

    // Incremented when images are loaded by the browser.
    this.costumesLoaded = 0;

    // Stacks to be pushed to the interpreter and run
    this.stacks = [];
	
	// Procedures
	this.procedures = {};
}
  
// Attaches a Sprite (<img>) to a Scratch scene
Sprite.prototype.attach = function(scene) {
    // Create textures and materials for each of the costumes.
    for (var c in this.costumes) {
        this.textures[c] = document.createElement('img');
        $(this.textures[c])
        .load([this, c], function(evo) {
            var sprite = evo.handleObj.data[0];
            var c = evo.handleObj.data[1];

            sprite.costumesLoaded += 1;
            sprite.updateCostume();

            $(sprite.textures[c]).css('display', (sprite.currentCostumeIndex == c) ? 'inline' : 'none');
            $(sprite.textures[c]).css('position', 'absolute').css('left', '0px').css('top', '0px');
            $(sprite.textures[c]).bind('dragstart', function(evt) { evt.preventDefault(); })
              .bind('selectstart', function(evt) { evt.preventDefault(); })
              .bind('touchend', function(evt) { sprite.onClick(evt); $(this).addClass('touched'); })
              .click(function(evt) {
                  if (!$(this).hasClass('touched')) {
                      sprite.onClick(evt);
                  } else {
                      $(this).removeClass('touched');
                  }
                });
            scene.append($(sprite.textures[c]));
        })
        .attr('src', io.asset_base + this.costumes[c].baseLayerMD5 + io.asset_suffix);
    }

    this.mesh = this.textures[this.currentCostumeIndex];
    this.updateLayer();
    this.updateVisible();
    this.updateTransform();

    this.talkBubble = $('<div class="bubble-container"></div>');
    this.talkBubble.css('display', 'none');
    this.talkBubbleBox = $('<div class="bubble"></div>');
    this.talkBubbleStyler = $('<div class="bubble-say"></div>');
    this.talkBubble.append(this.talkBubbleBox);
    this.talkBubble.append(this.talkBubbleStyler);
    
    runtime.scene.append(this.talkBubble);
}

// Load sounds from the server and buffer them
Sprite.prototype.loadSounds = function() {
    var spr = this;
    $.each(this.sounds, function (index, sound) {
        io.soundRequest(sound, spr);
    });
}

// True when all the costumes have been loaded
Sprite.prototype.isLoaded = function() {
    return (this.costumesLoaded == this.costumes.length 
            && this.soundsLoaded == Object.keys(this.sounds).length);
}
  
// Step methods
Sprite.prototype.showCostume = function(costume) {
    if (costume < 0) {
        costume += this.costumes.length;
    }
    if (!this.textures[costume]) {
        this.currentCostumeIndex = 0;
    }
    else {
        this.currentCostumeIndex = costume;
    }
    this.updateCostume();
}
  
Sprite.prototype.indexOfCostumeNamed = function(name) {
    for(var i in this.costumes) {
        var c = this.costumes[i];
        if(c['costumeName'] == name) {
            return i;
        }
    }
    return null;
}
  
Sprite.prototype.showCostumeNamed = function(name) {
    var index = this.indexOfCostumeNamed(name);
    if(!index) return;
    this.showCostume(index);
}
  
Sprite.prototype.updateCostume = function() {
    if(!this.textures[this.currentCostumeIndex]) {
        this.currentCostumeIndex = 0;
    }
    $(this.mesh).css('display', 'none');
    this.mesh = this.textures[this.currentCostumeIndex];
    this.updateVisible();
    this.updateTransform();
}
  
Sprite.prototype.onClick = function(evt) {
    // TODO - needs work!!
    var boxOffset = $('#container').offset();
    var mouseX = runtime.mousePos[0] + 240 + boxOffset.left;
    var mouseY = 180 - runtime.mousePos[1] + boxOffset.top;

    if (this.mesh.src.indexOf('.svg') == -1) {
        // HACK - if the image SRC doesn't indicate it's an SVG,
        // then we'll try to detect if the point we clicked is transparent
        // by rendering the sprite on a canvas.  With an SVG,
        // we are forced not to do this for now by Chrome/Webkit SOP:
        // http://code.google.com/p/chromium/issues/detail?id=68568
        var canv = document.createElement('canvas');
        $(canv).css('width', 480).css('height', 360);
        var ctx = canv.getContext('2d');
        var drawWidth = this.textures[this.currentCostumeIndex].width * this.scale;
        var drawHeight = this.textures[this.currentCostumeIndex].height * this.scale;
        var rotationCenterX = this.costumes[this.currentCostumeIndex].rotationCenterX;
        var rotationCenterY = this.costumes[this.currentCostumeIndex].rotationCenterY;
        var drawX = this.scratchX + (480 / 2) - rotationCenterX;
        var drawY = -this.scratchY + (360 / 2) - rotationCenterY;
        ctx.rotate(this.rotation * Math.PI / 180.0);
        ctx.drawImage(this.mesh, 0, 0, drawWidth, drawHeight);

        var offsetX = mouseX - drawX - 9; // the 9 is a hack - webkit/moz
        var offsetY = mouseY - drawY - 9;

        var idata = ctx.getImageData(offsetX, offsetY, 1, 1).data;
        var alpha = idata[3];
    } else {
        var alpha = 1;
    }

    if (alpha > 0) {
        // Start clicked hats if the pixel is non-transparent
        runtime.startClickedHats(this);
    } else {
        // Otherwise, move back a layer and trigger the click event
        $(this.mesh).hide();
        var underElement = document.elementFromPoint(mouseX, mouseY);
        $(underElement).click();
        $(this.mesh).show();
    }
}
  
Sprite.prototype.setVisible = function(v) {
    this.visible = v;
    this.updateVisible();
}

Sprite.prototype.updateLayer = function() {
    $(this.mesh).css('z-index', this.z);
    if (this.talkBubble) this.talkBubble.css('z-index', this.z);
}

Sprite.prototype.updateVisible = function() {
    $(this.mesh).css('display', (this.visible) ? 'inline' : 'none');
    if (this.talkBubbleOn)
        this.talkBubble.css('display', (this.visible) ? 'inline-block' : 'none');
}

Sprite.prototype.updateTransform = function() {
    var texture = this.textures[this.currentCostumeIndex];
    var resolution = this.costumes[this.currentCostumeIndex].bitmapResolution || 1;
    
    var drawWidth = texture.width * this.scale / resolution;
    var drawHeight = texture.height * this.scale / resolution;
    
    var rotationCenterX = this.costumes[this.currentCostumeIndex].rotationCenterX;
    var rotationCenterY = this.costumes[this.currentCostumeIndex].rotationCenterY;
    
    var drawX = this.scratchX + (480 / 2) - rotationCenterX;
    var drawY = -this.scratchY + (360 / 2) - rotationCenterY;

    var scaleXprepend = '';
    if (this.isFlipped) {
        scaleXprepend = '-'; // For a leftRight flip, we add a minus
        // sign to the X scale.
    }

    $(this.mesh).css('transform', 
                'translatex(' + drawX + 'px) \
                 translatey(' + drawY + 'px) \
                 rotate(' + this.rotation + 'deg) \
                 scaleX(' + scaleXprepend + (this.scale / resolution) + ') scaleY(' +  (this.scale / resolution) + ')');
    $(this.mesh).css('-moz-transform', 
                'translatex(' + drawX + 'px) \
                 translatey(' + drawY + 'px) \
                 rotate(' + this.rotation + 'deg) \
                 scaleX(' + scaleXprepend + this.scale + ') scaleY(' +  this.scale / resolution + ')');
    $(this.mesh).css('-webkit-transform', 
                'translatex(' + drawX + 'px) \
                 translatey(' + drawY + 'px) \
                 rotate(' + this.rotation + 'deg) \
                 scaleX(' + scaleXprepend + (this.scale / resolution) + ') scaleY(' +  (this.scale / resolution) + ')');
    
    $(this.mesh).css('-webkit-transform-origin', rotationCenterX + 'px ' + rotationCenterY + 'px'); 
    $(this.mesh).css('-moz-transform-origin', rotationCenterX + 'px ' + rotationCenterY + 'px'); 
    $(this.mesh).css('-ms-transform-origin', rotationCenterX + 'px ' + rotationCenterY + 'px'); 
    $(this.mesh).css('-o-transform-origin', rotationCenterX + 'px ' + rotationCenterY + 'px'); 
    $(this.mesh).css('transform-origin', rotationCenterX + 'px ' + rotationCenterY + 'px');

    // Don't forget to update the talk bubble.
    if (this.talkBubble) {
        var xy = this.getTalkBubbleXY();
        this.talkBubble.css('left', xy[0] + 'px');
        this.talkBubble.css('top', xy[1] + 'px');
    }
    
    this.updateLayer(); 
}

Sprite.prototype.getTalkBubbleXY = function() {
    var texture = this.textures[this.currentCostumeIndex];
    var drawWidth = texture.width * this.scale;
    var drawHeight = texture.height * this.scale;
    var rotationCenterX = this.costumes[this.currentCostumeIndex].rotationCenterX;
    var rotationCenterY = this.costumes[this.currentCostumeIndex].rotationCenterY;
    var drawX = this.scratchX + (480 / 2) - rotationCenterX;
    var drawY = -this.scratchY + (360 / 2) - rotationCenterY;
    return [drawX + drawWidth, drawY - drawHeight / 2];
}

Sprite.prototype.showBubble = function(text, type) {
    var xy = this.getTalkBubbleXY();

    this.talkBubbleOn = true;
    this.talkBubble.css('z-index', this.z);
    this.talkBubble.css('left', xy[0] + 'px');
    this.talkBubble.css('top', xy[1] + 'px');


    this.talkBubbleStyler.removeClass('bubble-say');
    this.talkBubbleStyler.removeClass('bubble-think');
    if (type == 'say') this.talkBubbleStyler.addClass('bubble-say');
    else if (type == 'think') this.talkBubbleStyler.addClass('bubble-think');
    
    if (this.visible)
        this.talkBubble.css('display', 'inline-block');
    this.talkBubbleBox.html(text);
}

Sprite.prototype.hideBubble = function() {
    this.talkBubbleOn = false;
    this.talkBubble.css('display', 'none');
}
  
Sprite.prototype.setXY = function(x, y) {
    this.scratchX = x;
    this.scratchY = y;
    this.updateTransform();
}
  
Sprite.prototype.setDirection = function(d) {
    var rotation;
    d = d % 360
    if (d < 0) d += 360;
    this.direction = (d > 180) ? d - 360 : d;
    if (this.rotationStyle == 'normal') {
        rotation = (this.direction - 90) % 360;
    } else if (this.rotationStyle == 'leftRight') {
        if (((this.direction - 90) % 360) >= 0) {
            this.isFlipped = false;
        } else {
            this.isFlipped = true;
        }
        rotation = 0;
    } else {
        rotation = 0;
    }
    this.rotation = rotation;
    this.updateTransform();
}

Sprite.prototype.setRotationStyle = function(r) {
    this.rotationStyle = r;
}
  
Sprite.prototype.getSize = function() {
    return this.scale * 100;
}

Sprite.prototype.setSize = function(percent) {
    var newScale = percent / 100.0;
    newScale = Math.max(0.05, Math.min(newScale, 100));
    this.scale = newScale;
    this.updateTransform();
}
  
// Move functions
Sprite.prototype.keepOnStage = function() {
    var x = this.scratchX + 240;
    var y = 180 - this.scratchY;
    var myBox = this.getRect();
    var inset = -Math.min(18, Math.min(myBox.width, myBox.height) / 2);
    var edgeBox = new Rectangle(inset, inset, 480 - (2 * inset), 360 - (2 * inset));
    if (myBox.intersects(edgeBox)) return; // sprite is sufficiently on stage
    if (myBox.right < edgeBox.left) x += edgeBox.left - myBox.right;
    if (myBox.left > edgeBox.right) x -= myBox.left - edgeBox.right;
    if (myBox.bottom < edgeBox.top) y += edgeBox.top - myBox.bottom;
    if (myBox.top > edgeBox.bottom) y -= myBox.top - edgeBox.bottom;
    this.scratchX = x - 240;
    this.scratchY = 180 - y;
}

Sprite.prototype.getRect = function() {
    var cImg = this.textures[this.currentCostumeIndex];
    var x = this.scratchX + 240 - (cImg.width/2.0);
    var y = 180 - this.scratchY - (cImg.height/2.0);
    var myBox = new Rectangle(x, y, cImg.width, cImg.height);
    return myBox;
}
  
// Pen functions 
Sprite.prototype.setPenColor = function(c) {
    var hsv = Color.rgb2hsv(c);
    this.penHue = (200 * hsv[0]) / 360 ;
    this.penShade = 50 * hsv[2];  // not quite right; doesn't account for saturation
    this.penColorCache = c;
}
Sprite.prototype.setPenHue = function(n) { 
    this.penHue = n % 200;
    if (this.penHue < 0) this.penHue += 200;
    this.updateCachedPenColor();
}
Sprite.prototype.setPenShade = function(n) { 
    this.penShade = n % 200;
    if (this.penShade < 0) this.penShade += 200;
    this.updateCachedPenColor();
}
Sprite.prototype.updateCachedPenColor = function() {
    var c = Color.fromHSV((this.penHue * 180.0) / 100.0, 1, 1);
    var shade = (this.penShade > 100) ? 200 - this.penShade : this.penShade; // range 0..100
    if (shade < 50) {
        this.penColorCache = Color.mixRGB(0, c, (10 + shade) / 60.0);
    } else {
        this.penColorCache = Color.mixRGB(c, 0xFFFFFF, (shade - 50) / 60);
    }
}
  
Sprite.prototype.stamp = function(canvas, opacity) {
    var drawWidth = this.textures[this.currentCostumeIndex].width * this.scale;
    var drawHeight = this.textures[this.currentCostumeIndex].height * this.scale;
    var drawX = this.scratchX + (480 / 2);
    var drawY = -this.scratchY + (360 / 2);
    canvas.globalAlpha = opacity / 100.0;
    canvas.save();
    canvas.translate(drawX, drawY);
    canvas.rotate(this.rotation * Math.PI / 180.0);
    canvas.drawImage(this.mesh, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
    canvas.restore();
    canvas.globalAlpha = 1;
}

Sprite.prototype.soundNamed = function(name) {
    if (name in this.sounds && this.sounds[name].buffer)
        return this.sounds[name];
    else if (name in runtime.stage.sounds && runtime.stage.sounds[name].buffer)
        return runtime.stage.sounds[name];
    return null;
}
