'use strict';

var React = require('react-native');
var {
  Dimensions,
  Text,
  View,
  TouchableOpacity,
  PanResponder,
  Animated,
  PropTypes,
  StyleSheet,
  Component,
  ScrollView,
  ViewPagerAndroid,
  LayoutAnimation,
  Platform
} = React;

var DefaultViewPageIndicator = require('./DefaultViewPageIndicator');
var deviceWidth = Dimensions.get('window').width;

const propTypes = {
  ...View.propTypes,
  onChangePage : PropTypes.func,
  renderPageIndicator :
    PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.bool
    ]),
  isLoop : PropTypes.bool,
  locked : PropTypes.bool,
  autoPlay : PropTypes.bool,
  animation : PropTypes.func,
  currentPage : PropTypes.number,
  hasTouch : PropTypes.func,
  //cacheNum : PropTypes.number,
  nativeRender : PropTypes.bool,
}

const defaultProps = {
  isLoop: false,
  locked: false,
  currentPage: 0,
  nativeRender : false,
  //cacheNum : 2,
  animation: function (animate, toValue) {
    return Animated.spring(animate,
      {
        toValue: toValue,
        friction: 10,
        tension: 50,
      })
  },
}

export default class ViewPager extends Component
{
  constructor(props) {
    super(props);

    this.state = {
      currentPage: props.currentPage,
      viewWidth: 0,
      scrollValue: new Animated.Value(props.currentPage === 0 ? 0 : 1)
    }
  }

  fling= false

  componentWillMount() {

    this.childIndex = this.state.currentPage === 0 ? 0 : 1;

    var release = (e, gestureState) => {
      const  relativeGestureDistance = gestureState.dx / deviceWidth
      const vx = gestureState.vx;

      let step = 0;
      if (relativeGestureDistance < -0.2 || (relativeGestureDistance < 0 && vx <= -0.5)) {
        step = 1;
      } else if (relativeGestureDistance > 0.2 || (relativeGestureDistance > 0 && vx >= 0.5)) {
        step = -1;
      }

      this.props.hasTouch && this.props.hasTouch(false);

      this.movePage(step);
    }

    this._panResponder = PanResponder.create({
      // Claim responder if it's a horizontal pan
      onMoveShouldSetPanResponder: (e, gestureState) => {
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          if (/* (gestureState.moveX <= this.props.edgeHitWidth ||
             gestureState.moveX >= deviceWidth - this.props.edgeHitWidth) && */
          this.props.locked !== true && !this.fling) {
            this.props.hasTouch && this.props.hasTouch(true);
            return true;
          }
        }
      },

      // Touch is released, scroll to the one that you're closest to
      onPanResponderRelease: release,
      onPanResponderTerminate: release,

      // Dragging, move the view with the touch
      onPanResponderMove: (e, gestureState) => {
        var dx = gestureState.dx;
        var offsetX = -dx / this.state.viewWidth + this.childIndex;
        this.state.scrollValue.setValue(offsetX);
      },
      onPanResponderTerminationRequest: (evt, gestureState) => {
        return true;
      },
    });

    const pageCount = this._getPageCount()
    if (this.props.isLoop && pageCount > 1) {
      this.childIndex = 1;
      this.state.scrollValue.setValue(1);
    }
  }

  componentDidMount()
  {
    const pageCount = this._getPageCount()
    if (this.props.autoPlay && pageCount > 1) {
      this._startAutoPlay();
    }
  }

  componentWillReceiveProps(nextProps)
  {
    const pageCount = nextProps.children.length;

    if (nextProps.autoPlay && pageCount > 1) {
      this._startAutoPlay();
    } else {
      if (this._autoPlayer) {
        clearInterval(this._autoPlayer);
        this._autoPlayer = null;
      }
    }

    var maxPage = pageCount - 1;
    var constrainedPage = Math.max(0, Math.min(this.state.currentPage, maxPage));
    this.setState({
      currentPage: constrainedPage,
    });

    if (constrainedPage > 0 || (nextProps.isLoop && pageCount > 1)) {
      this.childIndex = 1
    }
    else {
      this.childIndex = 0
    }
    this.state.scrollValue.setValue(this.childIndex);
  }

  _getPageCount() {
    return this.props.children.length;
  }

  _startAutoPlay()
  {
    if (!this._autoPlayer) {
      this._autoPlayer = setInterval(
        () => {
          this.movePage(1, true);
        },
        5000
      )
    }
  }

  goToPage(pageNumber)
  {
    var pageCount = this._getPageCount();
    if (pageNumber < 0 || pageNumber >= pageCount) {
      console.error('Invalid page number: ', pageNumber);
      return
    }

    var step = pageNumber - this.state.currentPage;
    this.movePage(step);
  }

  movePage(step, animated)
  {
    var pageCount = this._getPageCount()
    var pageNumber = this.state.currentPage + step;

    if (this.props.isLoop && pageCount > 1) {
      pageNumber = (pageNumber + pageCount) % pageCount;
    } else {
      pageNumber = Math.min(Math.max(0, pageNumber), pageCount - 1);
    }

    var moved = pageNumber !== this.state.currentPage;
    var scrollStep = (moved ? step : 0) + this.childIndex;

    this.fling = true;

    const loop = this.props.isLoop && pageCount > 1;
    var nextChildIdx = 0;
    if (pageNumber > 0 || loop) {
      nextChildIdx = 1;
    }

    const finish = ()=>{
      this.fling = false;
      this.childIndex = nextChildIdx;
      this.state.scrollValue.setValue(nextChildIdx);
      this.setState({
        currentPage: pageNumber,
      });
      moved && this.props.onChangePage && this.props.onChangePage(pageNumber);
    }
    if (this.scrollViewIOS) {
      if (animated) {
        LayoutAnimation.easeInEaseOut();
      }
      finish();
      this.scrollViewIOS.scrollTo(0,this.state.viewWidth * nextChildIdx, false);

    }
    else if (this.viewPagerAndroid) {
      finish();
      if (animated) {
        if (loop) {
          this.viewPagerAndroid.setPage(1+pageNumber);
        }
        else {
          this.viewPagerAndroid.setPage(pageNumber);
        }
      }
      else {
        if (loop) {
          this.viewPagerAndroid.setPageWithoutAnimation(1+pageNumber);
        }
        else {
          this.viewPagerAndroid.setPageWithoutAnimation(pageNumber);
        }
      }
    }
    else {
      // LayoutAnimation.easeInEaseOut();
      // finish()
      this.props.animation(this.state.scrollValue, scrollStep)
        .start((event) => {
          finish()
        });
    }
  }

  getCurrentPage()
  {
    return this.state.currentPage;
  }

  renderPageIndicator(props)
  {
    if (this.props.renderPageIndicator === false) {
      return null;
    } else if (this.props.renderPageIndicator) {
      return React.cloneElement(this.props.renderPageIndicator(), props);
    } else {
      return (
        <View style={styles.indicators}>
          <DefaultViewPageIndicator {...props} />
        </View>
      );
    }
  }

  _getPage(pageIdx, loop = false)
  {
    const {children} = this.props;
    return React.cloneElement(children[pageIdx], {key: 'p_' + pageIdx + (loop ? '_1' : '')})
  }

  render()
  {
    if (this.props.nativeRender && Platform.OS === 'android') {
      return this.renderViewPagerAndroid();
    }

    var pageCount = this._getPageCount()

    var bodyComponents = [];

    var pagesNum = 0;
    var hasLeft = false;
    var viewWidth = this.state.viewWidth;

    if (pageCount > 0 && viewWidth > 0) {
      // left page
      if (this.state.currentPage > 0) {
        bodyComponents.push(this._getPage(this.state.currentPage - 1));
        pagesNum++;
        hasLeft = true;
      } else if (this.state.currentPage == 0 && this.props.isLoop && pageCount > 1) {
        bodyComponents.push(this._getPage(pageCount - 1, true));
        pagesNum++;
        hasLeft = true;
      }

      // center page
      bodyComponents.push(this._getPage(this.state.currentPage));
      pagesNum++;

      // right page
      if (this.state.currentPage < pageCount - 1) {
        bodyComponents.push(this._getPage(this.state.currentPage + 1));
        pagesNum++;
      } else if (this.state.currentPage == pageCount - 1 && this.props.isLoop && pageCount > 1) {
        bodyComponents.push(this._getPage(0, true));
        pagesNum++;
      }
    }

    var sceneContainerStyle = {
      width: viewWidth * pagesNum,
      flex: 1,
      flexDirection: 'row'
    };

    var translateX = this.state.scrollValue.interpolate({
      inputRange: [0, 1], outputRange: [0, -viewWidth]
    });

    return (
      <View style={{flex: 1}}
            onLayout={(event) => {
              // console.log('ViewPager.onLayout()');
              var viewWidth = event.nativeEvent.layout.width;
              if (!viewWidth || this.state.viewWidth === viewWidth) {
                return;
              }
              this.setState({
                currentPage: this.state.currentPage,
                viewWidth: viewWidth,
              });
            }}
      >
        {
          this.props.nativeRender && Platform.OS === 'ios'?
            this.renderScrollViewIOS(bodyComponents, sceneContainerStyle):
            this.renderAnimationView(bodyComponents, sceneContainerStyle, translateX)
        }
        {this.renderPageIndicator({
          goToPage: this.goToPage.bind(this),
          pageCount: pageCount,
          activePage: this.state.currentPage,
          scrollValue: this.state.scrollValue,
          scrollOffset: this.childIndex,
        })}
      </View>
    );
  }

  renderAnimationView(bodyComponents, sceneContainerStyle, translateX) {
    return (
      <Animated.View style={[sceneContainerStyle, {transform: [{translateX}]}]}
        {...this._panResponder.panHandlers}>
        <View
          style={sceneContainerStyle}
        >
          {bodyComponents}
        </View>
      </Animated.View>
    )
  }

  renderScrollViewIOS(bodyComponents, sceneContainerStyle) {
      const viewWidth = this.state.viewWidth;
      return(
        <ScrollView
          horizontal = {true}
          showsHorizontalScrollIndicator = {false}
          showsVerticalScrollIndicator = {false}
          scrollsToTop = {false}
          pagingEnabled = {true}
          contentOffset = {{x:this.childIndex * viewWidth,y:0}}
          ref={ref=>this.scrollViewIOS = ref}
          contentContainerStyle={sceneContainerStyle}
          onScrollBeginDrag={this.onScrollBeginDragIOS.bind(this)}
          onScrollEndDrag = {this.onScrollEndDragIOS.bind(this)}
          onMomentumScrollEnd={this.onScrollEndIOS.bind(this)}
        >
          {
            bodyComponents
          }
        </ScrollView>
      )
  }

  onScrollBeginDragIOS(e) {
    this.fling = true;
    this.props.hasTouch && this.props.hasTouch(false);
  }

  onScrollEndDragIOS(e) {
    const v = e.nativeEvent.velocity.x;
    this.props.hasTouch && this.props.hasTouch(false);
  }

  onScrollEndIOS(e) {
    this.fling = false;

    const viewWidth = this.state.viewWidth;
    const offsetX = e.nativeEvent.contentOffset.x;
    const curPage = Math.floor(offsetX/viewWidth + 0.5);

    if (curPage < this.childIndex) {
      this.movePage(-1);
    }
    else if (curPage > this.childIndex) {
      this.movePage(1);
    }
  }

  renderViewPagerAndroid() {
    const {isLoop} = this.props;
    const count = this._getPageCount();
    const loop = isLoop && count > 1;

    let bodyComponents = [];
    for (let i = 0;i<count;i++) {
      bodyComponents.push(this._getPage(i, false));
    }

    if (loop) {
      bodyComponents = [this._getPage(count-1, true),...bodyComponents, this._getPage(0, true)];
    }

    return (
      <View style={{flex: 1}}
            onLayout={(event) => {
              var viewWidth = event.nativeEvent.layout.width;
              if (!viewWidth || this.state.viewWidth === viewWidth) {
                return;
              }
              this.setState({
                currentPage: this.state.currentPage,
                viewWidth: viewWidth,
              });
            }}
      >
        <ViewPagerAndroid
          ref={ref=>this.viewPagerAndroid = ref}
          style={{flex: 1}}
          initialPage={this.state.currentPage + (loop?1:0)}
          onPageSelected={this.onPageChangedAndroid.bind(this)}
        >
          {
            bodyComponents
          }
        </ViewPagerAndroid>
        {this.renderPageIndicator({
          goToPage: this.goToPage.bind(this),
          pageCount: count,
          activePage: this.state.currentPage,
          scrollValue: this.state.scrollValue,
          scrollOffset: this.childIndex,
        })}
      </View>
    )
  }

  onPageChangedAndroid(e) {
    const {isLoop} = this.props;
    const count = this._getPageCount()
    const loop = isLoop && count > 1;

    let position = e.nativeEvent.position;
    if (loop) {
      position = position-1;
    }

    if (position > this.state.currentPage) {
      this.movePage(1);
    }
    else if (position < this.state.currentPage) {
      this.movePage(-1);
    }
  }

}

ViewPager.propTypes = propTypes;
ViewPager.defaultProps = defaultProps;

var styles = StyleSheet.create({
  indicators: {
    flex: 1,
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
});