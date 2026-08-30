import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  FlatList,
  View,
  StyleSheet,
  type ScrollViewProps,
  type FlatListProps,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type Direction = 'vertical' | 'horizontal';

export interface EdgeFadeScrollViewProps extends Omit<ScrollViewProps, 'onScroll'> {
  direction?: Direction;
  fadeColor?: string;
  fadeSize?: number;
  /**
   * Optional Reanimated SharedValue that is updated natively with the current
   * scroll offset on every scroll frame. When provided, the scroll handler
   * runs entirely on the UI thread so downstream animations can be driven
   * natively for buttery-smooth updates.
   */
  scrollOffset?: SharedValue<number>;
  /**
   * Optional Reanimated SharedValue that is updated with the scroll view's
   * measured viewport height. Use this to compute fixed-viewport positions
   * (e.g. a playhead pinned to the middle of the screen) on the UI thread.
   */
  viewportHeight?: SharedValue<number>;
}

export interface EdgeFadeFlatListProps<T> extends Omit<FlatListProps<T>, 'onScroll' | 'onContentSizeChange' | 'onRefresh'> {
  direction?: Direction;
  fadeColor?: string;
  fadeSize?: number;
  scrollOffset?: SharedValue<number>;
}

const DEFAULT_FADE_COLOR = '#fff8f0';
const DEFAULT_FADE_SIZE = 32;
const THRESHOLD = 8;
const FADE_DURATION = 150;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

function useEdgeFade(
  direction: Direction,
  fadeColor: string,
  fadeSize: number,
  sharedScrollOffset: SharedValue<number>,
) {
  const isHorizontal = direction === 'horizontal';

  const [contentSize, setContentSize] = useState(0);
  const [layoutSize, setLayoutSize] = useState(0);

  const startProgress = useSharedValue(0);
  const endProgress = useSharedValue(0);

  const isScrollable = contentSize > layoutSize + 1;

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      setContentSize(isHorizontal ? w : h);
    },
    [isHorizontal],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setLayoutSize(isHorizontal ? width : height);
    },
    [isHorizontal],
  );

  const overlayBase: ViewStyle = {
    position: 'absolute',
    zIndex: 10,
  };

  const renderOverlays = () => {
    if (!isScrollable) return null;

    if (isHorizontal) {
      return (
        <>
          <FadeOverlay
            style={[{ left: 0, top: 0, bottom: 0, width: fadeSize }, overlayBase]}
            progress={startProgress}
            colors={[fadeColor, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <FadeOverlay
            style={[{ right: 0, top: 0, bottom: 0, width: fadeSize }, overlayBase]}
            progress={endProgress}
            colors={['transparent', fadeColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </>
      );
    }

    return (
      <>
        <FadeOverlay
          style={[{ top: 0, left: 0, right: 0, height: fadeSize }, overlayBase]}
          progress={startProgress}
          colors={[fadeColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <FadeOverlay
          style={[{ bottom: 0, left: 0, right: 0, height: fadeSize }, overlayBase]}
          progress={endProgress}
          colors={['transparent', fadeColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </>
    );
  };

  return {
    handleContentSizeChange,
    handleLayout,
    renderOverlays,
    isHorizontal,
    contentSize,
    layoutSize,
    isScrollable,
    startProgress,
    endProgress,
  };
}

function FadeOverlay({
  style,
  progress,
  colors,
  start,
  end,
}: {
  style: ViewStyle[];
  progress: SharedValue<number>;
  colors: [string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[style, animatedStyle]}>
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const EdgeFadeScrollView = React.forwardRef<ScrollView, EdgeFadeScrollViewProps>(
  (props, ref) => {
    const {
      direction = 'vertical',
      fadeColor = DEFAULT_FADE_COLOR,
      fadeSize = DEFAULT_FADE_SIZE,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle,
      scrollOffset: externalScrollOffset,
      viewportHeight: externalViewportHeight,
      ...scrollProps
    } = props;

    const internalOffset = useSharedValue(0);
    const sharedScrollOffset = externalScrollOffset ?? internalOffset;
    const internalViewportHeight = useSharedValue(0);
    const sharedViewportHeight = externalViewportHeight ?? internalViewportHeight;

    const {
      handleContentSizeChange,
      handleLayout,
      renderOverlays,
      isHorizontal,
      contentSize,
      layoutSize,
      isScrollable,
      startProgress,
      endProgress,
    } = useEdgeFade(direction, fadeColor, fadeSize, sharedScrollOffset);

    const maxOffset = Math.max(0, contentSize - layoutSize);
    const scrollable = isScrollable;

    const scrollHandler = useAnimatedScrollHandler({
      onScroll: (e) => {
        'worklet';
        const offset = isHorizontal ? e.contentOffset.x : e.contentOffset.y;
        sharedScrollOffset.value = offset;

        if (!scrollable) {
          startProgress.value = 0;
          endProgress.value = 0;
        } else {
          const showStart = offset > THRESHOLD;
          const showEnd = offset < maxOffset - THRESHOLD;
          startProgress.value = withTiming(showStart ? 1 : 0, { duration: FADE_DURATION });
          endProgress.value = withTiming(showEnd ? 1 : 0, { duration: FADE_DURATION });
        }
      },
    });

    const composedOnContentSizeChange = useCallback(
      (w: number, h: number) => {
        handleContentSizeChange(w, h);
        onContentSizeChange?.(w, h);
      },
      [onContentSizeChange, handleContentSizeChange],
    );

    const composedOnLayout = useCallback(
      (e: LayoutChangeEvent) => {
        handleLayout(e);
        const dim = e.nativeEvent.layout;
        sharedViewportHeight.value = isHorizontal ? dim.width : dim.height;
        onLayout?.(e);
      },
      [onLayout, handleLayout, sharedViewportHeight, isHorizontal],
    );

    return (
      <View style={wrapperStyle}>
        <AnimatedScrollView
          ref={ref as any}
          {...scrollProps}
          onScroll={scrollHandler}
          onContentSizeChange={composedOnContentSizeChange}
          onLayout={composedOnLayout}
          scrollEventThrottle={scrollEventThrottle ?? 16}
        />
        {renderOverlays()}
      </View>
    );
  },
);

EdgeFadeScrollView.displayName = 'EdgeFadeScrollView';

function EdgeFadeFlatList<T>(props: EdgeFadeFlatListProps<T>) {
  const {
    direction = 'vertical',
    fadeColor = DEFAULT_FADE_COLOR,
    fadeSize = DEFAULT_FADE_SIZE,
    scrollOffset: externalScrollOffset,
    ...flatListProps
  } = props;

  const internalOffset = useSharedValue(0);
  const sharedScrollOffset = externalScrollOffset ?? internalOffset;

  const {
    handleContentSizeChange,
    handleLayout,
    renderOverlays,
    isHorizontal,
    contentSize,
    layoutSize,
    isScrollable,
    startProgress,
    endProgress,
  } = useEdgeFade(direction, fadeColor, fadeSize, sharedScrollOffset);

  const maxOffset = Math.max(0, contentSize - layoutSize);
  const scrollable = isScrollable;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      const offset = isHorizontal ? e.contentOffset.x : e.contentOffset.y;
      sharedScrollOffset.value = offset;

      if (!scrollable) {
        startProgress.value = 0;
        endProgress.value = 0;
      } else {
        const showStart = offset > THRESHOLD;
        const showEnd = offset < maxOffset - THRESHOLD;
        startProgress.value = withTiming(showStart ? 1 : 0, { duration: FADE_DURATION });
        endProgress.value = withTiming(showEnd ? 1 : 0, { duration: FADE_DURATION });
      }
    },
  });

  return (
    <View style={wrapperStyle}>
      <AnimatedFlatList
        {...(flatListProps as any)}
        onScroll={scrollHandler as any}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        scrollEventThrottle={16}
      />
      {renderOverlays()}
    </View>
  );
}

const wrapperStyle: ViewStyle = {
  flex: 1,
  position: 'relative',
};

export { EdgeFadeScrollView, EdgeFadeFlatList };
