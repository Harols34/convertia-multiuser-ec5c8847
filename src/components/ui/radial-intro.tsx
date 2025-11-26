import * as React from 'react';
import {
    LayoutGroup,
    motion,
    useAnimate,
    type Transition,
    type AnimationSequence,
} from 'framer-motion';

// Note: The original code used 'motion/react' which might be from the 'motion' package or a newer framer-motion.
// Since we installed 'framer-motion', we'll try to use that.
// 'delay' is not a standard export from framer-motion in the same way.
// We'll implement a simple delay helper or use setTimeout.

const delay = (fn: () => void, ms: number) => setTimeout(fn, ms);


interface ComponentProps {
    orbitItems: OrbitItem[];
    stageSize?: number;
    imageSize?: number;
}

export type OrbitItem = {
    id: number;
    name: string;
    src?: string;
    icon?: React.ReactNode;
};

const transition: Transition = {
    delay: 0,
    stiffness: 300,
    damping: 35,
    type: 'spring',
    restSpeed: 0.01,
    restDelta: 0.01,
};

const spinConfig = {
    duration: 30,
    ease: 'linear' as const,
    repeat: Infinity,
};

const qsa = (root: Element, sel: string) =>
    Array.from(root.querySelectorAll(sel));

const angleOf = (el: Element) => Number((el as HTMLElement).dataset.angle || 0);

const armOfImg = (img: Element) =>
    (img as HTMLElement).closest('[data-arm]') as HTMLElement | null;

export const RadialIntro = ({
    orbitItems,
    stageSize = 320,
    imageSize = 60,
}: ComponentProps) => {
    const step = 360 / orbitItems.length;
    const [scope, animate] = useAnimate();

    React.useEffect(() => {
        const root = scope.current;
        if (!root) return;

        // get arm and image elements
        const arms = qsa(root, '[data-arm]');
        const imgs = qsa(root, '[data-arm-image]');
        const stops: Array<() => void> = [];

        // image lift-in
        delay(() => animate(imgs, { top: 0 }, transition), 250);

        // build sequence for orbit placement
        const orbitPlacementSequence: AnimationSequence = [
            ...arms.map((el): [Element, Record<string, any>, any] => [
                el,
                { rotate: angleOf(el) },
                { ...transition, at: 0 },
            ]),
            ...imgs.map((img): [Element, Record<string, any>, any] => [
                img,
                { rotate: -angleOf(armOfImg(img)!), opacity: 1 },
                { ...transition, at: 0 },
            ]),
        ];

        // play placement sequence
        delay(() => animate(orbitPlacementSequence), 700);

        // start continuous spin for arms and images
        delay(() => {
            // arms spin clockwise
            arms.forEach((el) => {
                const angle = angleOf(el);
                const ctrl = animate(el, { rotate: [angle, angle + 360] }, spinConfig);
                stops.push(() => ctrl.stop); // framer-motion animate returns { stop, ... }
            });

            // images counter-spin to stay upright
            imgs.forEach((img) => {
                const arm = armOfImg(img);
                const angle = arm ? angleOf(arm) : 0;
                const ctrl = animate(
                    img,
                    { rotate: [-angle, -angle - 360] },
                    spinConfig,
                );
                stops.push(() => ctrl.stop);
            });
        }, 1300);

        return () => stops.forEach((stop) => stop());
    }, []);

    return (
        <LayoutGroup>
            <motion.div
                ref={scope}
                className="relative overflow-visible"
                style={{ width: stageSize, height: stageSize }}
                initial={false}
            >
                {orbitItems.map((item, i) => (
                    <motion.div
                        key={item.id}
                        data-arm
                        className="will-change-transform absolute inset-0"
                        style={{ zIndex: orbitItems.length - i }}
                        data-angle={i * step}
                        layoutId={`arm-${item.id}`}
                    >
                        <motion.div
                            data-arm-image
                            className="rounded-full absolute left-1/2 top-1/2 -translate-x-1/2 flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
                            style={{
                                width: imageSize,
                                height: imageSize,
                                opacity: i === 0 ? 1 : 0,
                            }}
                            layoutId={`arm-img-${item.id}`}
                        >
                            {item.icon ? (
                                <div className="">{item.icon}</div>
                            ) : (
                                <img
                                    src={item.src}
                                    alt={item.name}
                                    className="w-full h-full object-cover rounded-full"
                                    draggable={false}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                ))}
            </motion.div>
        </LayoutGroup>
    );
};
