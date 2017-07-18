attribute mediump vec2 screenSize;
attribute mediump vec2 coords;

void main() {
	gl_Position = vec4(coords / screenSize * 2.0 - 1.0, 0.0, 1.0);
}
