"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
if (!Error.captureStackTrace && !self.__Error__) {
    //@ts-ignore
    self.__Error__ = self.Error;
    class Error {
        constructor(message) {
            this.message = message;
            //@ts-ignore
            this.stack = ((new self.__Error__(message)).stack + "").split("↵").join("\n");
        }
    }
    //@ts-ignore
    self.Error = Error;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxZQUFZO0FBQ1osSUFBRyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQztJQUMvQyxZQUFZO0lBQ1osSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQzVCLE1BQU0sS0FBSztRQUdWLFlBQVksT0FBYztZQUN6QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztZQUN2QixZQUFZO1lBQ1osSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0UsQ0FBQztLQUNEO0lBRUQsWUFBWTtJQUNaLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvL0B0cy1pZ25vcmVcbmlmKCFFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSAmJiAhc2VsZi5fX0Vycm9yX18pe1xuXHQvL0B0cy1pZ25vcmVcblx0c2VsZi5fX0Vycm9yX18gPSBzZWxmLkVycm9yO1xuXHRjbGFzcyBFcnJvcntcblx0XHRzdGFjazpzdHJpbmc7XG5cdFx0bWVzc2FnZTpzdHJpbmc7XG5cdFx0Y29uc3RydWN0b3IobWVzc2FnZTpzdHJpbmcpIHtcblx0XHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0XHQvL0B0cy1pZ25vcmVcblx0XHRcdHRoaXMuc3RhY2sgPSAoKG5ldyBzZWxmLl9fRXJyb3JfXyhtZXNzYWdlKSkuc3RhY2srXCJcIikuc3BsaXQoXCLihrVcIikuam9pbihcIlxcblwiKTtcblx0XHR9XG5cdH1cblxuXHQvL0B0cy1pZ25vcmVcblx0c2VsZi5FcnJvciA9IEVycm9yO1xufVxuXG5leHBvcnQge307Il19