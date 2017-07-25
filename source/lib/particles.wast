(module
	;; Fancy debug functions
	;; (that actually are just console.log)
	(func $logi32 (import "console" "log") (param i32))
	(func $logf32 (import "console" "log") (param f32))

	;; Config
	(global $particlesDensity (import "config" "density") f32)
	(global $particlesSpeed (import "config" "speed") f32)
	(global $edgesDistance (import "config" "distance") f32)

	(memory 1)
	(export "mem" (memory 0))

	;; xorshift stuff
	(global $xorshift_seed (mut i32) (i32.const 1))
	;; xorshift is a PRNG algo. It's insanely fast and
	;; its distrbution good enough for this task
	(func $xorshiftRand (result i32)
		(local $x i32)

		(get_global $xorshift_seed)

		(tee_local $x)
		(i32.const 13)
		(i32.shl)
		(get_local $x)
		(i32.xor)

		(tee_local $x)
		(i32.const 17)
		(i32.shr_u)
		(get_local $x)
		(i32.xor)

		(tee_local $x)
		(i32.const 5)
		(i32.shl)
		(get_local $x)
		(i32.xor)

		(tee_local $x)
		(set_global $xorshift_seed)
		(get_local $x)
	)

	;; particles stuff
	(global $particlesCount (mut i32) (i32.const 0))
	(global $edgesPtr (mut i32) (i32.const 0))
	(global $edgesCount (mut i32) (i32.const 0))
	(global $width (mut f32) (f32.const 0))
	(global $height (mut f32) (f32.const 0))
	(global $timestamp (mut f64) (f64.const 0))

	(func $resize (param $width f32) (param $height f32)
		(local $float1 f32) ;; General purpose variable
		(local $float2 f32) ;; General purpose variable

		(local $newParticlesCount i32) ;; New particles count
		(local $ptr i32) ;; General purpose variable
		(local $max i32) ;; General purpose variable

		;; scale X
		(set_local $float1 (f32.div (get_local $width) (get_global $width)))
		;; scale Y
		(set_local $float2 (f32.div (get_local $height) (get_global $height)))

		(call $logf32 (get_local $float1)) ;; DEBUG

		;; Set upper boundary
		(set_local $max
			(i32.mul
				(get_global $particlesCount)
				(i32.const 20) ;; Stride, 20 bytes = 5 * f32
			)
		)

		;; $ptr is already initialized as 0

		;; Scale all existing points coordinates
		(loop $continueScale
			;; This loop will run at least once, i.e, the zeroth element is always scaled.
			;; Assuming this whole thing has no sense with zero particles, it's fine.

			(f32.store offset=4 align=4 (get_local $ptr)
				(f32.mul
					(get_local $float1)
					(f32.load offset=4 align=4 (get_local $ptr))
				)
			)

			(f32.store offset=8 align=4 (get_local $ptr)
				(f32.mul
					(get_local $float1)
					(f32.load offset=8 align=4 (get_local $ptr))
				)
			)

			(i32.add (get_local $ptr) (i32.const 20)) ;; Advance ptr to the next item
			(tee_local $ptr)
			(i32.lt_u (get_local $max))
			(br_if 0)
		)


		;; How many points are there now
		(f32.mul (get_local $width) (get_local $height))
		(f32.mul (get_global $particlesDensity))

		(i32.trunc_u/f32) ;; Convert f32 to i32
		(set_local $newParticlesCount)

		;; Get new memory pages if needed
		(i32.mul (get_local $newParticlesCount) (i32.const 20)) ;; How much memory do we need
		(tee_local $max)
		(i32.sub
			(i32.add (i32.shr_u (i32.const 16)) (i32.const 1)) ;; In pages
			(current_memory)
		)
		(tee_local $ptr)
		(if (i32.gt_u (i32.const 0))
			(then
				(grow_memory (get_local $ptr))
				(drop) ;; TODO: Catch memory grow failure
			)
		)

		;; TODO: Initialize xorshift seed

		;; Now it's safe to fill new points
		(i32.mul (get_global $particlesCount) (i32.const 20))
		(set_local $ptr)
		(loop $fillInContinue
			(get_local $max)
			(get_local $ptr)
			(if (i32.gt_u)
				(then
					;; X
					(f32.store offset=4 align=4 (get_local $ptr) ;; X coord ptr = ptr + 4
						(f32.convert_u/i32 (call $xorshiftRand))
						(f32.div (f32.const 0x100000000))
						(f32.mul (get_local $width))
					)

					;; Y
					(f32.store offset=8 align=4 (get_local $ptr) ;; Y coord ptr = ptr + 8
						(f32.convert_u/i32 (call $xorshiftRand))
						(f32.div (f32.const 0x100000000))
						(f32.mul (get_local $height))
					)

					;; DX
					(f32.store offset=12 align=4 (get_local $ptr) ;; DX coord ptr = ptr + 12
						(f32.convert_s/i32 (call $xorshiftRand))
						(f32.div (f32.const 0x80000000))
						(f32.mul (get_global $particlesSpeed))
					)

					;; DY
					(f32.store offset=16 align=4 (get_local $ptr) ;; DY coord ptr
						(f32.convert_s/i32 (call $xorshiftRand))
						(f32.div (f32.const 0x80000000))
						(f32.mul (get_global $particlesSpeed))
					)

					;; Advance to the next item
					(i32.add (get_local $ptr) (i32.const 20))
					(set_local $ptr)
					(br 1) ;; For some reason wabt messes up code here if label is used
				)
			)
		)

		;; Set particles size according to its index in range [8, 4)
		(set_local $ptr (i32.const 0))
		(set_local $float1
			(f32.div
				(f32.const 4)
				(f32.convert_u/i32 (get_local $max))
			)
		)
		;; $max is unchanged
		(loop $pointSizeContinue
			(get_local $max)
			(get_local $ptr)
			(if (i32.gt_u)
				(then
					(get_local $ptr) ;; Write ptr
					(f32.sub
						(f32.const 8)
						(f32.mul
							(get_local $float1)
							(f32.convert_u/i32 (get_local $ptr))
						)
					)
					(f32.store align=4)

					;; Advance to the next item
					(i32.add (get_local $ptr) (i32.const 20))
					(set_local $ptr)
					(br 1) ;; For some reason wabt messes up code here if label is used
				)
			)
		)


		(set_global $particlesCount (get_local $newParticlesCount))
		(set_global $width (get_local $width))
		(set_global $height (get_local $height))
		(set_global $edgesPtr (get_local $max))
	)

	(func $wrapOver (param $value f32) (param $modulo f32) (result f32)
		(local $integralPart f32)

		(get_local $value)
		(f32.div (get_local $value) (get_local $modulo))
		(f32.floor)
		(f32.mul (get_local $modulo))
		(f32.sub)
	)

	(func $computeEdge
		(param $x1 f32) (param $y1 f32) (param $x2 f32) (param $y2 f32)
		(local $dist f32)
		(local $dx f32)
		(local $dy f32)
		(local $ptr i32)
		(local $factor f32) ;; TODO: Reuse some variables

		;; Calculate distance between points storing dx and dy
		(tee_local $dx (f32.sub (get_local $x1) (get_local $x2)))
		(get_local $dx)
		(f32.mul)

		(tee_local $dy (f32.sub (get_local $y1) (get_local $y2)))
		(get_local $dy)
		(f32.mul)

		(f32.add)
		(f32.sqrt)

		(tee_local $dist)
		(if
			(f32.ge (get_global $edgesDistance))
			(then
				(return) ;; Points are too far away
			)
		)

		;; Get memory pointer
		(set_local $ptr
			(i32.add
				(i32.mul
					(get_global $edgesCount)
					(i32.const 8) ;; 2 coordinates, 4 bytes each
				)
				(get_global $edgesPtr)
			)
		)

		;; Make sure there's enough memory
		(i32.gt_u
			(i32.add (get_local $ptr) (i32.const 48)) ;; Memory we need
			(i32.shl(current_memory) (i32.const 16)) ;; Memory we have
		)
		(if
			(then
				(grow_memory (i32.const 1))
				(drop) ;; TODO: Catch
			)
		)

		;; TODO: Use opacity if the line width is smaller than 1
		;; TODO: Division by zero
		(set_local $factor
			(f32.sub
				(f32.div
					(f32.const 1)
					(get_local $dist)
				)
				(f32.div
					(f32.const 1)
					(get_global $edgesDistance)
				)
			)
		)

		;; Scale down, so abs(dx, dy) = 1
		;; and (!) exchange them, so dx and dy becomes perpendicular to its original position
		(f32.mul (get_local $dx) (get_local $factor))
		(f32.mul (get_local $dy) (get_local $factor))
		(f32.neg)
		(set_local $dx)
		(set_local $dy)

		;; Fill memory. Luckily, we don't care about triangles winding.
		(f32.store offset=0 (get_local $ptr)
			(f32.add (get_local $x1) (get_local $dx)) ;; vertex 0 [1+] X
		)
		(f32.store offset=4 (get_local $ptr) ;; vertex 0 [1+] Y
			(f32.add (get_local $y1) (get_local $dy))
		)

		(f32.store offset=40 (get_local $ptr) ;; vertex 5 [2-] X
			(f32.sub (get_local $x2) (get_local $dx))
		)
		(f32.store offset=44 (get_local $ptr) ;; vertex 5 [2-] Y
			(f32.sub (get_local $y2) (get_local $dy))
		)

		;; From this point we don't care much about $x1, $y1, $x2, $y2
		;; and we can reuse them

		;; Vertices 1 and 3 has same coords. Same for 2 and 4

		(f32.store offset=8 (get_local $ptr) ;; Ptr of vertex 1 [2+] X
			(tee_local $x2
				(f32.add (get_local $x2) (get_local $dx))
			)
		)

		(f32.store offset=24 (get_local $ptr) ;; Ptr of vertex 3 [2+] X
			(get_local $x2)
		)

		(f32.store offset=12 (get_local $ptr) ;; Ptr of vertex 1 [2+] Y
			(tee_local $y2
				(f32.add (get_local $y2) (get_local $dy))
			)
		)
		(f32.store offset=28 (get_local $ptr) ;; Ptr of vertex 3 [2+] Y
			(get_local $y2)
		)

		;; Phew! Once more.

		(f32.store offset=16 (get_local $ptr) ;; Ptr of vertex 2 [1-] X
			(tee_local $x1
				(f32.sub (get_local $x1) (get_local $dx))
			)
		)

		(f32.store offset=32 (get_local $ptr) ;; Ptr of vertex 4 [1-] X
			(get_local $x1)
		)

		(f32.store offset=20 (get_local $ptr) ;; Ptr of vertex 2 [1-] Y
			(tee_local $y1
				(f32.sub (get_local $y1) (get_local $dy))
			)
		)
		(f32.store offset=36 (get_local $ptr) ;; Ptr of vertex 4 [1-] Y
			(get_local $y1)
		)

		;; I don't know how to debug that if something goes wrong.
		(set_global $edgesCount (i32.add (get_global $edgesCount) (i32.const 6)))
	)

	(func (export "compute")
		(param $width f32) (param $height f32) (param $timestamp f64)
		(local $timestampDiff f32)
		(local $max i32)
		(local $ptr i32)
		(local $ptrInner i32)
		(local $tmp1 f32)
		(local $tmp2 f32)

		(set_global $edgesCount (i32.const 0))

		(f32.ne (get_local $width) (get_global $width))
		(f32.ne (get_local $height) (get_global $height))
		(i32.or)
		(if
			(then
				(call $resize (get_local $width) (get_local $height))
			)
		)

		(if
			(f64.gt (get_global $timestamp) (f64.const 0))
			(then
				(f64.sub (get_local $timestamp) (get_global $timestamp))
				(f64.div (f64.const 1000))
				(set_local $timestampDiff (f32.demote/f64))
			)
		)
		(set_global $timestamp (get_local $timestamp))

		(set_local $max (get_global $edgesPtr))

		(loop
			(get_local $max)
			(get_local $ptr)
			(if (i32.gt_u)
				(then
					;; DX
					(f32.store offset=4 (get_local $ptr) ;; X write ptr
						(f32.add
							(f32.load offset=4 (get_local $ptr)) ;; X read ptr
							(f32.mul
								(f32.load offset=12 (get_local $ptr)) ;; DX read ptr
								(get_local $timestampDiff)
							)
						)
						(tee_local $tmp1
							(call $wrapOver (get_local $width))
						)
					)

					;; DY
					(f32.store offset=8 (get_local $ptr) ;; Y write ptr
						(f32.add
							(f32.load offset=8 (get_local $ptr)) ;; Y read ptr
							(f32.mul
								(f32.load offset=16 (get_local $ptr)) ;; DY read ptr
								(get_local $timestampDiff)
							)
						)
						(tee_local $tmp2
							(call $wrapOver (get_local $height))
						)
					)

					;; inner loop
					(set_local $ptrInner (i32.const 0))
					(loop $inner
						(if
							(i32.lt_u (get_local $ptrInner) (get_local $ptr))
							(then
								(get_local $tmp1)
								(get_local $tmp2)
								(f32.load offset=4 (get_local $ptrInner))
								(f32.load offset=8 (get_local $ptrInner))
								(call $computeEdge)
								(set_local $ptrInner (i32.add (get_local $ptrInner) (i32.const 20)))
								(br 1)
							)
						)
					)

					(set_local $ptr (i32.add (get_local $ptr) (i32.const 20)))
					(br 1)
				)
			)
		)
	)

	(func (export "pointsCount") (result i32)
		(get_global $particlesCount)
	)

	(func (export "edgesPtr") (result i32)
		(get_global $edgesPtr)
	)

	(func (export "edgesCount") (result i32)
		(get_global $edgesCount)
	)
)
