from manim import *

class RotatingSquare(Scene):
    def construct(self):
        square = Square(side_length=2)
        square.set_fill(BLUE, opacity=0.5)
        square.set_stroke(WHITE, width=3)

        self.play(Create(square))
        self.play(
            Rotate(square, angle=2*PI, about_point=ORIGIN, run_time=5, rate_func=linear)
        )
        self.wait(1)
        self.play(FadeOut(square))