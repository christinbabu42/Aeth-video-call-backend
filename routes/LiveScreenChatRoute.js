// LiveScreenChatRoute.js
import LiveScreenChat from '../live-component/live/LiveScreenChat';

export const LiveChatRoute = {
  name: "LiveScreenChat",
  component: LiveScreenChat,
  options: {
    headerShown: false,
    animation: 'fade', // Smooth transition into the stream
  },
};